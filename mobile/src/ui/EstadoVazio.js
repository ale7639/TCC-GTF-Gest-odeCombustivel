import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BORDA, CINZA_FUNDO, RAIO_CARTAO, TEXTO, TEXTO_SUAVE, VERMELHO_SUAVE } from './tema';

/**
 * Empty state consistente: ícone + título + dica em PT.
 * props: icone, titulo, dica, compacto
 */
export default function EstadoVazio({
  icone = 'inbox-outline',
  titulo = 'Nada por aqui ainda',
  dica,
  compacto = false,
  style,
}) {
  return (
    <View style={[styles.caixa, compacto && styles.compacto, style]} accessibilityRole="text">
      <View style={styles.iconeWrap}>
        <MaterialCommunityIcons name={icone} size={compacto ? 22 : 28} color="#9ca3af" />
      </View>
      <Text style={[styles.titulo, compacto && styles.tituloCompacto]}>{titulo}</Text>
      {dica ? <Text style={styles.dica}>{dica}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: RAIO_CARTAO,
    borderWidth: 1,
    borderColor: BORDA,
    marginTop: 8,
  },
  compacto: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
    borderWidth: 0,
    backgroundColor: CINZA_FUNDO,
  },
  iconeWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: VERMELHO_SUAVE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  titulo: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXTO,
    textAlign: 'center',
  },
  tituloCompacto: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXTO_SUAVE,
    textAlign: 'left',
  },
  dica: {
    fontSize: 13,
    color: TEXTO_SUAVE,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
