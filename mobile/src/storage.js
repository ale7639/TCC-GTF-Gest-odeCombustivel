import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Guarda pequenos dados (como o token de login).
// No celular usa o cofre seguro; no navegador (versão web) usa o localStorage,
// porque o SecureStore não existe lá.
export const armazenamento = {
  async ler(chave) {
    if (Platform.OS === 'web') return window.localStorage.getItem(chave);
    return SecureStore.getItemAsync(chave);
  },

  async gravar(chave, valor) {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(chave, valor);
      return;
    }
    await SecureStore.setItemAsync(chave, valor);
  },

  async apagar(chave) {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(chave);
      return;
    }
    await SecureStore.deleteItemAsync(chave);
  },
};