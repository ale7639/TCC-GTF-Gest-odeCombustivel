// =====================================================================================
// FotoAmpliavel.js — mostra a foto pequena no card e, ao tocar, abre em tela cheia.
//
// Usada em:
//   - Aprovacoes.js   (o admin confere a nota do posto antes de aprovar)
//   - NotasFiscais.js (consulta da nota depois de aprovada)
//
// Uso: <FotoAmpliavel uri={item.foto_url} style={styles.foto} resizeMode="cover" />
//   uri        -> endereço da foto (vem da API como foto_url, já com a assinatura de segurança)
//   style      -> tamanho da miniatura no card
//   resizeMode -> como a miniatura preenche o espaço ('cover' corta, 'contain' mostra inteira)
// =====================================================================================

import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export default function FotoAmpliavel({ uri, style, resizeMode = 'cover' }) {
  // aberta = true -> a foto está em tela cheia.
  const [aberta, setAberta] = useState(false);

  return (
    <>
      {/* Miniatura no card. Tocar nela abre a tela cheia. */}
      <Pressable onPress={() => setAberta(true)} accessibilityLabel="Ampliar a foto da nota">
        <Image source={{ uri }} style={style} resizeMode={resizeMode} />
        <Text style={styles.dica}>Toque na foto para ampliar</Text>
      </Pressable>

      {/* Tela cheia: fundo escuro e a foto inteira, sem cortar (resizeMode "contain").
          transparent = deixa o fundo escuro semitransparente por cima da tela.
          onRequestClose = o botão "voltar" do celular também fecha. */}
      <Modal visible={aberta} transparent animationType="fade" onRequestClose={() => setAberta(false)}>
        <View style={styles.fundo}>
          <Image source={{ uri }} style={styles.grande} resizeMode="contain" />
          <Pressable style={styles.fechar} onPress={() => setAberta(false)} accessibilityLabel="Fechar a foto">
            <Text style={styles.fecharTexto}>Fechar</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dica: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  // Fundo quase preto ocupando a tela toda.
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  // A foto ocupa quase toda a tela, com espaço para o botão embaixo.
  grande: { width: '100%', height: '85%' },
  fechar: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  fecharTexto: { fontSize: 16, fontWeight: '600', color: '#111827' },
});