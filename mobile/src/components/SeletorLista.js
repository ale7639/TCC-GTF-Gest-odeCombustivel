import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Lista suspensa (dropdown) no estilo dos campos do app.
// opcoes: [{ valor, rotulo }] — valor pode ser null (ex.: "Nenhum" / "Todos").
// comBusca: campo de filtro dentro do modal (útil com muitas placas/fornecedores).
// permiteLivre: se a busca não bater numa opção, permite confirmar o texto digitado.
export default function SeletorLista({
  rotulo,
  valor,
  opcoes,
  aoMudar,
  placeholder = 'Selecionar…',
  vazio = 'Nenhuma opção disponível.',
  comBusca = true,
  permiteLivre = false,
  placeholderBusca = 'Buscar…',
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const escolhida = opcoes.find((o) => o.valor === valor);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return opcoes;
    return opcoes.filter((o) => String(o.rotulo).toLowerCase().includes(q));
  }, [opcoes, busca]);

  const textoLivre = busca.trim();
  const mostrarLivre =
    permiteLivre &&
    textoLivre !== '' &&
    !opcoes.some((o) => String(o.rotulo).toLowerCase() === textoLivre.toLowerCase());

  const fechar = () => {
    setAberto(false);
    setBusca('');
  };

  const escolher = (v) => {
    aoMudar(v);
    fechar();
  };

  return (
    <View style={styles.grupo}>
      {rotulo ? <Text style={styles.rotulo}>{rotulo}</Text> : null}
      <Pressable
        style={styles.campo}
        onPress={() => setAberto(true)}
        accessibilityRole="button"
        accessibilityLabel={rotulo ? `Selecionar ${rotulo}` : 'Selecionar'}
      >
        <Text style={[styles.texto, !escolhida && !valor && styles.placeholder]} numberOfLines={1}>
          {escolhida?.rotulo ?? (permiteLivre && valor ? String(valor) : placeholder)}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color="#6b7280" />
      </Pressable>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={fechar}>
        <Pressable style={styles.fundo} onPress={fechar}>
          <Pressable style={styles.folha} onPress={(e) => e?.stopPropagation?.()}>
            <View style={styles.folhaTopo}>
              <Text style={styles.folhaTitulo}>{rotulo ?? 'Selecionar'}</Text>
              <Pressable onPress={fechar} style={styles.fechar} accessibilityLabel="Fechar" hitSlop={8}>
                <MaterialCommunityIcons name="close" size={24} color="#111827" />
              </Pressable>
            </View>

            {comBusca ? (
              <View style={styles.buscaCaixa}>
                <MaterialCommunityIcons name="magnify" size={20} color="#6b7280" />
                <TextInput
                  style={styles.busca}
                  placeholder={placeholderBusca}
                  value={busca}
                  onChangeText={setBusca}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                {busca !== '' ? (
                  <Pressable onPress={() => setBusca('')} hitSlop={8} accessibilityLabel="Limpar busca">
                    <MaterialCommunityIcons name="close-circle" size={18} color="#9ca3af" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <ScrollView style={styles.lista} keyboardShouldPersistTaps="handled">
              {mostrarLivre ? (
                <Pressable
                  style={styles.item}
                  onPress={() => escolher(textoLivre)}
                  accessibilityRole="button"
                  accessibilityLabel={`Usar ${textoLivre}`}
                >
                  <Text style={styles.itemTexto} numberOfLines={2}>
                    Usar «{textoLivre}»
                  </Text>
                  <MaterialCommunityIcons name="plus" size={20} color="#dc2626" />
                </Pressable>
              ) : null}

              {filtradas.length === 0 && !mostrarLivre ? (
                <Text style={styles.vazio}>{vazio}</Text>
              ) : (
                filtradas.map((o) => {
                  const ativo = o.valor === valor;
                  return (
                    <Pressable
                      key={String(o.valor) + '|' + o.rotulo}
                      style={[styles.item, ativo && styles.itemAtivo]}
                      onPress={() => escolher(o.valor)}
                      accessibilityRole="button"
                      accessibilityLabel={o.rotulo}
                    >
                      <Text style={[styles.itemTexto, ativo && styles.itemTextoAtivo]} numberOfLines={2}>
                        {o.rotulo}
                      </Text>
                      {ativo ? (
                        <MaterialCommunityIcons name="check" size={20} color="#dc2626" />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { marginBottom: 12 },
  rotulo: { fontSize: 14, color: '#374151', marginBottom: 6, fontWeight: '500' },
  campo: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  texto: { flex: 1, fontSize: 16, color: '#111827' },
  placeholder: { color: '#9ca3af' },
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  folha: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '70%',
    overflow: 'hidden',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  folhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 48,
  },
  folhaTitulo: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827', marginRight: 8 },
  fechar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  buscaCaixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  busca: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 4 },
  lista: { maxHeight: 360 },
  vazio: { padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 15 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    minHeight: 48,
    gap: 8,
  },
  itemAtivo: { backgroundColor: '#fef2f2' },
  itemTexto: { flex: 1, fontSize: 16, color: '#111827' },
  itemTextoAtivo: { color: '#dc2626', fontWeight: '600' },
});
