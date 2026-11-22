import { StyleSheet, View } from 'react-native';
import { cores, LARGURA_CELULAR } from './tema';

// Deixa o conteúdo no formato de celular, centralizado no monitor.
// Usada no app inteiro (App.js) e dentro dos formulários (Modal), que no navegador
// abrem por cima da página toda.
export default function Moldura({ children }) {
  return (
    <View style={styles.fora}>
      <View style={styles.celular}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fora: { flex: 1, backgroundColor: cores.fundoExterno, alignItems: 'center' },
  celular: {
    flex: 1,
    width: '100%',
    maxWidth: LARGURA_CELULAR,
    backgroundColor: cores.fundo,
    overflow: 'hidden',
    // sombra em volta da "tela de celular"
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});