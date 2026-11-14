import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cores } from '../ui/tema';

// Quantos caminhões aparecem na lista de cada vez (para não poluir a tela).
const LIMITE = 6;

// Deixa o texto fácil de comparar: minúsculo, sem acento e sem traço/espaço.
// "ABC-1D23" -> "abc1d23" | "João" -> "joao"
const normalizar = (texto) =>
  String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

// Escolha de caminhão com busca por placa, motorista ou modelo.
// Funciona bem com poucos ou com muitos caminhões: mostra no máximo 6 por vez.
// Uso: <SeletorCaminhao caminhoes={lista} selecionadoId={form.caminhao_id} aoEscolher={(c) => ...} />
export default function SeletorCaminhao({ caminhoes, selecionadoId, aoEscolher, vazio = 'Nenhum caminhão disponível.' }) {
  const [busca, setBusca] = useState('');
  const [trocando, setTrocando] = useState(false);

  const selecionado = caminhoes.find((c) => c.id === selecionadoId);

  // Já escolheu: mostra só o caminhão escolhido, com o botão "Trocar".
  if (selecionado && !trocando) {
    return (
      <View style={styles.escolhido}>
        <MaterialCommunityIcons name="truck-outline" size={22} color={cores.primaria} />
        <View style={{ flex: 1 }}>
          <Text style={styles.placa}>{selecionado.placa}</Text>
          <Text style={styles.detalhe} numberOfLines={1}>
            {selecionado.motorista?.nome ?? 'sem motorista'} · {selecionado.modelo}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            setBusca('');
            setTrocando(true);
          }}
          hitSlop={8}
        >
          <Text style={styles.trocar}>Trocar</Text>
        </Pressable>
      </View>
    );
  }

  const termo = normalizar(busca);
  const encontrados = caminhoes.filter(
    (c) =>
      !termo ||
      normalizar(c.placa).includes(termo) ||
      normalizar(c.motorista?.nome).includes(termo) ||
      normalizar(c.modelo).includes(termo)
  );
  const visiveis = encontrados.slice(0, LIMITE);

  return (
    <View style={styles.bloco}>
      <View style={styles.busca}>
        <MaterialCommunityIcons name="magnify" size={20} color={cores.textoSecundario} />
        <TextInput
          style={styles.buscaCampo}
          placeholder="Buscar placa ou motorista"
          value={busca}
          onChangeText={setBusca}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {caminhoes.length === 0 && <Text style={styles.aviso}>{vazio}</Text>}
      {caminhoes.length > 0 && encontrados.length === 0 && (
        <Text style={styles.aviso}>Nenhum caminhão encontrado para "{busca}".</Text>
      )}

      {visiveis.map((c) => (
        <Pressable
          key={c.id}
          style={styles.item}
          onPress={() => {
            setTrocando(false);
            aoEscolher(c);
          }}
        >
          <Text style={styles.placa}>{c.placa}</Text>
          <Text style={styles.detalhe} numberOfLines={1}>
            {c.motorista?.nome ?? 'sem motorista'} · {c.modelo}
          </Text>
        </Pressable>
      ))}

      {encontrados.length > LIMITE && (
        <Text style={styles.aviso}>
          + {encontrados.length - LIMITE} caminhões. Digite a placa ou o nome para encontrar.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { marginBottom: 16 },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  buscaCampo: { flex: 1, paddingVertical: 10, fontSize: 15 },
  item: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: cores.bordaClara,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  escolhido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: cores.primariaClara,
    borderWidth: 1,
    borderColor: cores.primaria,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  placa: { fontSize: 15, fontWeight: 'bold', color: cores.texto },
  detalhe: { fontSize: 13, color: cores.textoSecundario, marginTop: 1 },
  trocar: { fontSize: 14, fontWeight: '700', color: cores.primaria },
  aviso: { fontSize: 13, color: cores.textoSecundario, marginBottom: 6 },
});