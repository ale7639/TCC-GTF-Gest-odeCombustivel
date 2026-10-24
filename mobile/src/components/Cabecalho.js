import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMenu } from '../menu/MenuContext';

// Cabeçalho de todas as telas: botão do menu (três risquinhos) + título + botões opcionais à direita.
// Uso: <Cabecalho titulo="GESTÃO DE FROTA"> <botão /> </Cabecalho>
export default function Cabecalho({ titulo, children }) {
  const { abrir } = useMenu();

  return (
    <View style={styles.linha}>
      <Pressable onPress={abrir} style={styles.menu} accessibilityLabel="Abrir menu" hitSlop={8}>
        <MaterialCommunityIcons name="menu" size={28} color="#111827" />
      </Pressable>
      <Text style={styles.titulo} numberOfLines={1}>
        {titulo}
      </Text>
      <View style={styles.direita}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  menu: { marginRight: 10 },
  titulo: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#111827' },
  direita: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
});