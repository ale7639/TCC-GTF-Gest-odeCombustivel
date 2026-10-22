import { Platform } from 'react-native';

// IP do computador na rede, usado só quando o app roda no CELULAR (comando ipconfig).
// Na versão web (navegador do próprio computador) o endereço é sempre 127.0.0.1.
const IP_DO_COMPUTADOR = '172.16.8.110';

export const API_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8000/api'
    : `http://${IP_DO_COMPUTADOR}:8000/api`;