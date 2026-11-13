import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMenu } from '../menu/MenuContext';

const VERMELHO = '#dc2626';

// Faixa vermelha de topo (menu ☰ / voltar + título + ações), alinhada aos mockups.
// sangrar: use when the parent still has horizontal padding (telas antigas do menu Mais).
export default function Cabecalho({ titulo, children, aoVoltar, sangrar = false }) {
  const menu = useMenu();
  const fixo = menu?.fixo ?? false;
  const abrir = menu?.abrir;

  return (
    <View style={[styles.faixa, sangrar && styles.faixaSangrar]}>
      <View style={styles.linha}>
        {aoVoltar ? (
          <Pressable
            onPress={aoVoltar}
            style={({ pressed }) => [styles.icone, pressed && styles.iconePressionado]}
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="arrow-left" size={26} color="#fff" />
          </Pressable>
        ) : !fixo && abrir ? (
          <Pressable
            onPress={abrir}
            style={({ pressed }) => [styles.icone, pressed && styles.iconePressionado]}
            accessibilityLabel="Abrir menu"
            accessibilityRole="button"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="menu" size={26} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.icone} />
        )}
        <Text style={styles.titulo} numberOfLines={1}>
          {titulo}
        </Text>
        <View style={styles.direita}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  faixa: {
    backgroundColor: VERMELHO,
    paddingTop: Platform.OS === 'web' ? 14 : 48,
    paddingBottom: 12,
    paddingHorizontal: 10,
  },
  faixaSangrar: {
    marginHorizontal: -16,
    paddingHorizontal: 26,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  icone: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  iconePressionado: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  titulo: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  direita: {
    minWidth: 44,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
