import './main.ts';

function connectFromLobby() {
  const status = document.getElementById('status');

  try {
    const raw = sessionStorage.getItem('angel.ludo.connection.v1');
    if (!raw) return;

    const connection = JSON.parse(raw) as {
      room?: string;
      user?: string;
      ticket?: string;
      expires?: number;
    };

    if (
      typeof connection.room !== 'string' ||
      !connection.room ||
      typeof connection.user !== 'string' ||
      !connection.user ||
      typeof connection.ticket !== 'string' ||
      !/^[a-f0-9]{64}$/.test(connection.ticket) ||
      typeof connection.expires !== 'number' ||
      connection.expires <= Date.now()
    ) {
      sessionStorage.removeItem('angel.ludo.connection.v1');
      throw new Error('مجوز اتصال منقضی شده؛ از لابی دوباره وارد شوید.');
    }

    const endpoint = new URL('/ws', location.origin);
    endpoint.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

    // SDK removes the fragment and sends the ticket as a WS subprotocol.
    endpoint.hash = connection.ticket;

    const endpointInput = document.getElementById('endpoint') as HTMLInputElement;
    const roomInput = document.getElementById('room') as HTMLInputElement;
    const userInput = document.getElementById('user') as HTMLInputElement;
    const form = document.getElementById('connection') as HTMLFormElement;

    endpointInput.value = endpoint.href;
    roomInput.value = connection.room;
    userInput.value = connection.user;
    roomInput.readOnly = true;
    userInput.readOnly = true;

    // main.ts rejects a URL fragment, so use its existing form fields only
    // for display and connect through a temporary hash-free endpoint below.
    endpointInput.value = endpoint.href.replace(/#.*$/, '');

    // sdkFactory reads this tab-scoped ticket when called by main.ts.
    form.requestSubmit();
  } catch (error) {
    if (status) {
      status.textContent = error instanceof Error
        ? error.message
        : 'اطلاعات اتصال معتبر نیست؛ به لابی برگردید.';
    }
  }
}

queueMicrotask(connectFromLobby);
