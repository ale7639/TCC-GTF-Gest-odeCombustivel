import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { BORDA, RAIO_CARTAO, sombraSuave } from './tema';

const NATIVE = Platform.OS !== 'web';

function Bloco({ style }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: NATIVE }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: NATIVE }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return <Animated.View style={[styles.bloco, style, { opacity }]} />;
}

/** Skeleton de lista / cartões — substitui ActivityIndicator genérico. */
export default function Esqueleto({ linhas = 3, variante = 'lista' }) {
  if (variante === 'painel') {
    return (
      <View style={styles.wrap}>
        <Bloco style={styles.cartaoGrande} />
        <View style={styles.linha}>
          <Bloco style={styles.meio} />
          <Bloco style={styles.meio} />
        </View>
        <Bloco style={styles.cartaoMedio} />
        <Bloco style={styles.cta} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {Array.from({ length: linhas }).map((_, i) => (
        <View key={i} style={styles.item}>
          <Bloco style={styles.titulo} />
          <Bloco style={styles.sub} />
          <Bloco style={[styles.sub, { width: '55%' }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, gap: 10 },
  bloco: { backgroundColor: BORDA, borderRadius: 8 },
  item: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CARTAO,
    padding: 14,
    gap: 8,
    ...sombraSuave,
  },
  titulo: { height: 16, width: '42%' },
  sub: { height: 12, width: '78%' },
  cartaoGrande: { height: 110, borderRadius: RAIO_CARTAO, width: '100%' },
  cartaoMedio: { height: 88, borderRadius: RAIO_CARTAO, width: '100%' },
  cta: { height: 52, borderRadius: 12, width: '100%' },
  linha: { flexDirection: 'row', gap: 10 },
  meio: { flex: 1, height: 88, borderRadius: RAIO_CARTAO },
});
