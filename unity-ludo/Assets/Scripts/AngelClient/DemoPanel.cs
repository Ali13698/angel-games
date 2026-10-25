using System;
using System.Threading.Tasks;
using Angel;
using Google.Protobuf;
using UnityEngine;

namespace AngelClient
{
    [RequireComponent(typeof(NetworkManager), typeof(GameController))]
    public sealed class DemoPanel : MonoBehaviour
    {
        private NetworkManager _network;
        private GameController _game;
        private string _user = "";
        private string _room = "";
        private string _token = "0";
        private string _status = "Confirm the Go protocol before connecting.";
        private bool _started;

        private void Awake()
        {
            Application.runInBackground = true;
            _network = GetComponent<NetworkManager>();
            _game = GetComponent<GameController>();
        }

        private void OnEnable()
        {
            _network.Faulted += OnFault;
            _game.Rolled += OnRoll;
            _game.Moved += OnMove;
            _game.TurnChanged += OnTurn;
            _game.SnapshotReceived += OnSnapshot;
            _game.ServerError += OnServerError;
        }

        private void OnDisable()
        {
            _network.Faulted -= OnFault;
            _game.Rolled -= OnRoll;
            _game.Moved -= OnMove;
            _game.TurnChanged -= OnTurn;
            _game.SnapshotReceived -= OnSnapshot;
            _game.ServerError -= OnServerError;
        }

        private void OnFault(string text) { _started = false; _status = text; }
        private void OnRoll(RolledPayload value) => _status = $"Seat {value.Seat}: dice {value.Dice}";
        private void OnMove(MovedPayload value) =>
            _status = $"Seat {value.Seat}: token {value.Token}, position {value.Pos}";
        private void OnTurn(TurnPayload value) => _status = $"Turn: {value.Turn}";
        private void OnSnapshot(ByteString state) =>
            _status = $"Snapshot: {state.Length} bytes. Board decoding is NOT implemented.";
        private void OnServerError(ErrorMsg error) => _status = "Server rejected command: " + error.Code;

        private async void Run(Func<Task> operation)
        {
            try { await operation(); }
            catch (Exception e) { if (this != null) _status = e.Message; }
        }

        private void OnGUI()
        {
            GUILayout.BeginArea(new Rect(12, 12, Mathf.Min(Screen.width - 24, 500), 420));
            GUILayout.Label("Angel / binary protocol diagnostics");
            GUILayout.Label("User ID (not authentication)");
            _user = GUILayout.TextField(_user);
            GUILayout.Label("Room ID");
            _room = GUILayout.TextField(_room);
            GUI.enabled = !_started;
            if (GUILayout.Button("Connect / join"))
            {
                _started = true;
                Run(async () =>
                {
                    try { await _network.ConnectAsync(_user, _room); }
                    catch { _started = false; throw; }
                });
            }
            GUI.enabled = _started;
            if (GUILayout.Button("Disconnect"))
            {
                _started = false;
                Run(_network.DisconnectAsync);
            }
            GUI.enabled = _network.CanSend;
            if (GUILayout.Button("Roll")) Run(_network.SendRollAsync);
            _token = GUILayout.TextField(_token);
            if (GUILayout.Button("Move") && int.TryParse(_token, out var token))
                Run(() => _network.SendMoveAsync(token));
            GUI.enabled = true;
            if (GUILayout.Button("Check Telegram availability"))
                _status = TelegramBridge.ReadInitData().Length == 0
                    ? "Telegram initData unavailable." : "initData available; NOT authenticated.";
            GUILayout.Label(_status);
            GUILayout.EndArea();
        }
    }
}
