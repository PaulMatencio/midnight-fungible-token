const WS =
  typeof window !== 'undefined'
    ? window.WebSocket || window.MozWebSocket
    : typeof global !== 'undefined'
    ? global.WebSocket || global.MozWebSocket
    : null;

export default WS;
export { WS as WebSocket };
