using System;
using System.Threading;
using System.Threading.Tasks;
using Angel;
using Google.Protobuf;
using UnityEngine;

namespace AngelClient
{
    [RequireComponent(typeof(GameController))]
    public sealed class NetworkManager : MonoBehaviour
    {
        private const int MaxFrameBytes = 1024 * 1024;
        private readonly SemaphoreSlim _sendGate = new SemaphoreSlim(1, 1);
        private SocketTransport _transport;
        private GameController _game;
        private string _roomId;
        private bool _joined;
        private bool _destroyed;
        private float _connectDeadline;
        public bool CanSend => _joined && _game.HasRevision && _transport != null && _transport.IsOpen;
        public event Action<string> Faulted;
        private void Awake() => _game = GetComponent<GameController>();

        public async Task ConnectAsync(string userId, string roomId)
        {
            if (_destroyed || _transport != null)
                throw new InvalidOperationException("Disconnect before connecting again.");
            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(roomId))
                throw new ArgumentException("userId and roomId are required.");
            _roomId = roomId;
            _game.ResetSession();
            var socket = new SocketTransport(userId);
            _transport = socket;
            _connectDeadline = Time.realtimeSinceStartup + 20f;
            socket.Opened += () => OnOpened(socket);
            socket.Received += bytes => OnReceived(socket, bytes);
            socket.Failed += error => Fail(socket, "WebSocket connection failed.");
            socket.Closed += () => Fail(socket, "WebSocket closed; reconnect and resync.");
            try { await socket.ConnectAsync(); }
            catch (Exception) { Fail(socket, "WebSocket connection failed."); }
        }

        private async void OnOpened(SocketTransport socket)
        {
            try
            {
                await SendAsync(socket, "join", ByteString.Empty);
                if (socket == _transport) _joined = true;
            }
            catch (Exception) { Fail(socket, "Join could not be sent."); }
        }

        public Task SendRollAsync() => SendAsync(_transport, "roll", ByteString.Empty);
        public Task SendMoveAsync(int token) => SendAsync(_transport, "move",
            new MoveCommand { Token = token }.ToByteString());

        private async Task SendAsync(SocketTransport socket, string type, ByteString payload)
        {
            await _sendGate.WaitAsync();
            try
            {
                if (_destroyed || socket == null || socket != _transport || !socket.IsOpen)
                    throw new InvalidOperationException("Connection unavailable.");
                if (type != "join" && (!_joined || !_game.HasRevision))
                    throw new InvalidOperationException("Wait for an authoritative update.");
                var message = new ClientMsg
                {
                    Type = type, Id = Guid.NewGuid().ToString("N"),
                    RoomId = _roomId, Rev = _game.Revision, Payload = payload
                };
                try { await socket.SendAsync(message.ToByteArray()); }
                catch
                {
                    Fail(socket, "Send failed; resync before retrying.");
                    throw;
                }
            }
            finally { _sendGate.Release(); }
        }

        private void OnReceived(SocketTransport socket, byte[] bytes)
        {
            if (socket != _transport || _destroyed) return;
            try
            {
                if (bytes == null || bytes.Length == 0 || bytes.Length > MaxFrameBytes)
                    throw new InvalidOperationException("Invalid frame length.");
                var message = ServerMsg.Parser.ParseFrom(bytes);
                if (message.RoomId != _roomId &&
                    !(message.RoomId.Length == 0 && message.Error != null)) return;
                _game.HandleServerMsg(message);
            }
            catch (Exception) { Fail(socket, "Invalid server data or view handler failure."); }
        }

        private async void Fail(SocketTransport socket, string message)
        {
            if (_destroyed || socket != _transport) return;
            try
            {
                var closing = DisconnectAsync();
                Debug.LogWarning(message);
                try { Faulted?.Invoke(message); }
                finally { await closing; }
            }
            catch (Exception e) { Debug.LogWarning(e.GetType().Name); }
        }

        public Task DisconnectAsync()
        {
            var old = _transport;
            _transport = null;
            _joined = false;
            _game?.ResetSession();
            return old == null ? Task.CompletedTask : old.CloseAsync();
        }

        private void Update()
        {
            _transport?.Tick();
            if (_transport != null && !_game.HasRevision &&
                Time.realtimeSinceStartup > _connectDeadline)
                Fail(_transport, "Timed out waiting for the initial room update.");
        }
        private async void OnDestroy()
        {
            _destroyed = true;
            try { await DisconnectAsync(); }
            catch (Exception) { }
        }
    }
}
