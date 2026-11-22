import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cores } from '../ui/tema';

// Seção que abre e fecha ao tocar no título (a setinha gira para mostrar o estado).
// Uso: <SecaoRecolhivel titulo="Últimos abastecimentos" quantidade={5}> ...conteúdo... </SecaoRecolhivel>
// "abertaNoInicio" define se ela já começa aberta (padrão: fechada).
export default function SecaoRecolhivel({ titulo, quantidade, abertaNoInicio = false, children }) {
  const [aberta, setAberta] = useState(abertaNoInicio); // true = mostra o conteúdo

  return (
    <View style={styles.secao}>
      <Pressable style={styles.titulo} onPress={() => setAberta(!aberta)} accessibilityRole="button">
        <Text style={styles.tituloTexto}>
          {titulo}
          {/* Mostra quantos itens tem dentro, para saber o que há antes de abrir */}
          {quantidade != null ? <Text style={styles.quantidade}>  ({quantidade})</Text> : null}
        </Text>
        <MaterialCommunityIcons name={aberta ? 'chevron-up' : 'chevron-down'} size={24} color={cores.primaria} />
      </Pressable>

      {/* O conteúdo só aparece quando a seção está aberta */}
      {aberta && <View style={styles.conteudo}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  secao: { marginTop: 8 },
  titulo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: cores.bordaClara,
  },
  tituloTexto: { fontSize: 17, fontWeight: '600', color: cores.texto },
  quantidade: { fontSize: 14, fontWeight: '400', color: cores.textoSecundario },
  conteudo: { paddingTop: 8 },
});