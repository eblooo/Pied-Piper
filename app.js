const startCallButton = document.getElementById('startCall');
const endCallButton = document.getElementById('endCall');
const remoteAudio = document.getElementById('remoteAudio');

let pusher;
let channel;
let peerConnection;
let localStream;

const pusherKey = 'your-pusher-key';
const room = 'your-room-name'; // Replace with a unique room name

const iceServers = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function initializePusher() {
  pusher = new Pusher(pusherKey, {
    cluster: 'your-cluster',
    authEndpoint: 'http://localhost:3000/pusher/auth',
    auth: {
      params: {
        room: room
      }
    }
  });

  channel = pusher.subscribe(`presence-${room}`);

  channel.bind('client-signal', async (data) => {
    if (data.sdp) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if (data.sdp.type === 'offer') {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        signal({ sdp: peerConnection.localDescription });
      }
    } else if (data.ice) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.ice));
    }
  });
}

function signal(data) {
  fetch('http://localhost:3000/signal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: room, data: data })
  });
}

async function startCall() {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  peerConnection = new RTCPeerConnection(iceServers);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      signal({ ice: event.candidate });
    }
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  signal({ sdp: peerConnection.localDescription });
}

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (channel) {
    pusher.unsubscribe(`presence-${room}`);
  }
}

startCallButton.onclick = () => {
  initializePusher();
  startCall();
};

endCallButton.onclick = endCall;
