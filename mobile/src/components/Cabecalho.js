import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMenu } from '../menu/MenuContext';
import { cores } from '../ui/tema';

// Barra vermelha do topo de todas as telas.
// - à esquerda: botão do menu (☰) ou, se "aoVoltar" for passado, a seta de voltar (formulários);
// - no meio: o título;
// - à direita: botões opcionais da tela (ex.: "+ Novo").
// Uso: <Cabecalho titulo="GESTÃO DE FROTA"> <botão /> </Cabecalho>
//      <Cabecalho titulo="Novo caminhão" aoVoltar={fechar} />
// As margens negativas fazem a barra ocupar a largura toda, por cima do espaçamento da tela.
export default function Cabecalho({ titulo, children, aoVoltar }) {
  const menu = useMenu(); // fica vazio fora do menu (ex.: área do motorista)

  return (
    <View style={styles.barra}>
      <View style={styles.esquerda}>
        {aoVoltar ? (
          <Pressable onPress={aoVoltar} accessibilityLabel="Voltar" hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={26} color="#fff" />
          </Pressable>
        ) : menu?.abrir ? (
          <Pressable onPress={menu.abrir} accessibilityLabel="Abrir menu" hitSlop={8}>
            <MaterialCommunityIcons name="menu" size={28} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.titulo} numberOfLines={1}>
        {titulo}
      </Text>

      <View style={styles.direita}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cores.primaria,
    marginHorizontal: -16,
    marginTop: -56,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    minHeight: 64,
  },
  esquerda: { width: 40 },
  titulo: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 17, fontWeight: 'bold' },
  direita: { minWidth: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
});