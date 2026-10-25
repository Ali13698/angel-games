using System;
using System.Threading.Tasks;
using NativeWebSocket;
using UnityEngine;

namespace AngelClient
{
    /// <summary>
    /// Transport layer isolating NativeWebSocket from the game logic.
    /// Handles connection lifecycle and WebGL main-thread message dispatching.
    /// </summary>
    public sealed class SocketTransport
    {
        public event Action Opened;
        public event Action<byte[]> Received;
        public event Action<string> Failed;
        public event Action Closed;

        private readonly string _url;
        private WebSocket _socket;

        public bool IsOpen => _socket != null && _socket.State == WebSocketState.Open;

        public SocketTransport(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("userId cannot be null or empty.", nameof(userId));
            
            // Root Cause Fix: Escape userId to prevent URL injection
            _url = $"wss://game.nomi98.com/ws?user={Uri.EscapeDataString(userId)}";
        }

        public async Task ConnectAsync()
        {
            if (_socket != null)
                throw new InvalidOperationException("Socket instance already exists. Close before reconnecting.");

            _socket = new WebSocket(_url);
            
            _socket.OnOpen += HandleOpen;
            _socket.OnMessage += HandleMessage;
            _socket.OnError += HandleError;
            _socket.OnClose += HandleClose;

            await _socket.Connect();
        }

        public async Task SendAsync(byte[] data)
        {
            if (!IsOpen)
                throw new InvalidOperationException("Cannot send data while socket is not open.");
            
            if (data == null || data.Length == 0)
                return;

            await _socket.Send(data);
        }

        public async Task CloseAsync()
        {
            if (_socket == null)
                return;

            var socketToClose = _socket;
            _socket = null; // Prevent race conditions during async close

            if (socketToClose.State == WebSocketState.Open)
            {
                await socketToClose.Close();
            }
            
            socketToClose.OnOpen -= HandleOpen;
            socketToClose.OnMessage -= HandleMessage;
            socketToClose.OnError -= HandleError;
            socketToClose.OnClose -= HandleClose;
        }

        /// <summary>
        /// MUST be called from Unity's Update loop.
        /// WebGL queues incoming messages in JS; this flushes them to C#.
        /// </summary>
        public void Tick()
        {
            _socket?.DispatchMessageQueue();
        }

        private void HandleOpen() => Opened?.Invoke();
        private void HandleMessage(byte[] data) => Received?.Invoke(data);
        private void HandleError(string error) => Failed?.Invoke(error);
        private void HandleClose(WebSocketCloseCode code) => Closed?.Invoke();
    }
}
