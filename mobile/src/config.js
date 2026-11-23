import { Platform } from 'react-native';

// IP do computador na rede, usado só quando o app roda no CELULAR (comando ipconfig).
// Na versão web (navegador do próprio computador) o endereço é sempre 127.0.0.1.
const IP_DO_COMPUTADOR = '192.168.1.68';

export const API_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8000/api'
    : `http://${IP_DO_COMPUTADOR}:8000/api`;

// WhatsApp do administrador da frota (DDD + celular). Usado no "Esqueci minha senha" da tela de login.
// Para outra empresa, é só trocar esta linha.
export const WHATSAPP_ADMIN = '44 98751-3965';