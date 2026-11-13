import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RAIO_CARTAO, TEXTO, TEXTO_SUAVE, VERMELHO, VERMELHO_SUAVE } from './tema';

/** Erro de tela amigável em PT, com ação opcional de tentar de novo. */
export default function MensagemErro({
  titulo = 'Não foi possível carregar',
  mensagem = 'Verifique a conexão e se o servidor está ligado.',
  aoTentar,
  style,
}) {
  return (
    <View style={[styles.caixa, style]} accessibilityRole="alert">
      <MaterialCommunityIcons name="wifi-off" size={26} color={VERMELHO} />
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.mensagem}>{mensagem}</Text>
      {aoTentar ? (
        <Pressable
          onPress={aoTentar}
          style={({ pressed }) => [styles.botao, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
        >
          <Text style={styles.botaoTexto}>Tentar novamente</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    marginTop: 24,
    marginHorizontal: 4,
    padding: 18,
    borderRadius: RAIO_CARTAO,
    backgroundColor: VERMELHO_SUAVE,
    alignItems: 'center',
  },
  titulo: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: TEXTO,
    textAlign: 'center',
  },
  mensagem: {
    marginTop: 6,
    fontSize: 13,
    color: TEXTO_SUAVE,
    textAlign: 'center',
    lineHeight: 18,
  },
  botao: {
    marginTop: 14,
    backgroundColor: VERMELHO,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
