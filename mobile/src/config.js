import { Platform } from 'react-native';

// IP do computador na rede, usado só quando o app roda no CELULAR (comando ipconfig).
// Na versão web (navegador do próprio computador) o endereço 127.0.0.1:8000 é
// interceptado pelo Cursor neste PC — API local sobe em 8002.
const IP_DO_COMPUTADOR = '192.168.1.120';

export const API_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8002/api'
    : `http://${IP_DO_COMPUTADOR}:8002/api`;