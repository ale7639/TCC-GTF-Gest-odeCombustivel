import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';

// Funções de formatação.
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const litrosFmt = (n) => {                                            // "273.50" -> "273,5"
  const [inteiro, decimal] = String(Number(n)).split('.');
  return separar(inteiro) + (decimal ? `,${decimal}` : '');
};
const moeda = (n) => 'R$ ' + separar(Number(n).toFixed(2).replace('.', ','));
const dataBR = (d) => d.slice(0, 10).split('-').reverse().join('/');  // "2026-10-16..." -> "16/10/2026"

// A tela mostra a data como dd/mm/aaaa; a API recebe aaaa-mm-dd.
const hoje = () => {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
};
const paraISO = (texto) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

// Mensagem amigável para qualquer erro de comunicação com a API.
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

// Formulário em branco para uma entrada nova.
const formVazio = () => ({
  tanque_id: null,
  data: hoje(),
  litros: '',
  valor_total: '',
  nf_numero: '',
  nf_fornecedor: '',
  nf_chave_acesso: '',
});

// Campo de texto com rótulo em cima.
function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
    </View>
  );
}

// Botão de escolha (usado para o tanque).
function Opcao({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.opcao, ativo && styles.opcaoAtiva]}>
      <Text style={[styles.opcaoTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

// Esta tela aparece dentro da aba "Tanques", no botão "Entradas".
export default function Entradas() {
  const [entradas, setEntradas] = useState([]);
  const [tanques, setTanques] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);

  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null); // item que aguarda o segundo toque para excluir

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      // As duas listas são buscadas ao mesmo tempo.
      const [listaEntradas, listaTanques] = await Promise.all([api('/entradas'), api('/tanques')]);
      setEntradas(listaEntradas);
      setTanques(listaTanques);
    } catch (e) {
      setErro('Não foi possível carregar as entradas. Verifique se o servidor está ligado.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const abrirNovo = () => {
    setForm(formVazio());
    setErroForm(null);
    setFormAberto(true);
  };

  const fechar = () => {
    setFormAberto(false);
    setErroForm(null);
  };

  const salvar = async () => {
    const litros = Number(String(form.litros).replace(',', '.'));
    const valor = Number(String(form.valor_total).replace(',', '.'));
    const data = paraISO(form.data);

    if (!form.tanque_id) {
      setErroForm('Escolha o tanque.');
      return;
    }
    if (!(litros > 0)) {
      setErroForm('Informe a quantidade de litros.');
      return;
    }
    if (form.valor_total === '' || Number.isNaN(valor) || valor < 0) {
      setErroForm('Informe o valor total da compra.');
      return;
    }
    if (!data) {
      setErroForm('Informe a data no formato dd/mm/aaaa.');
      return;
    }

    setSalvando(true);
    setErroForm(null);
    try {
      await api('/entradas', {
        metodo: 'POST',
        corpo: {
          tanque_id: form.tanque_id,
          data,
          litros,
          valor_total: valor,
          // Campos da nota fiscal: vazio vira null (a nota é opcional).
          nf_numero: form.nf_numero.trim() || null,
          nf_fornecedor: form.nf_fornecedor.trim() || null,
          nf_chave_acesso: form.nf_chave_acesso.replace(/\D/g, '') || null,
        },
      });
      fechar();
      await carregar();
    } catch (e) {
      setErroForm(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id) => {
    // Primeiro toque: pede confirmação. Segundo toque: exclui.
    if (confirmandoId !== id) {
      setConfirmandoId(id);
      return;
    }

    try {
      await api(`/entradas/${id}`, { metodo: 'DELETE' });
      setConfirmandoId(null);
      await carregar();
    } catch (e) {
      setErro(mensagemDe(e));
      setConfirmandoId(null);
    }
  };

  return (
    <View style={styles.raiz}>
      <View style={styles.cabecalho}>
        <Text style={styles.subtitulo}>Compras de combustível</Text>
        <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
          <Text style={styles.botaoNovoTexto}>+ Nova entrada</Text>
        </Pressable>
      </View>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      <FlatList
        data={entradas}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => {
              setAtualizando(true);
              carregar();
            }}
          />
        }
        ListEmptyComponent={
          !carregando && !erro ? <Text style={styles.vazio}>Nenhuma entrada registrada.</Text> : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.caixa}>
            <View style={styles.topo}>
              <Text style={styles.principal}>
                {item.tanque.nome} · +{litrosFmt(item.litros)} L
              </Text>
              <Pressable onPress={() => excluir(item.id)}>
                <Text style={[styles.excluir, confirmandoId === item.id && styles.excluirAtivo]}>
                  {confirmandoId === item.id ? 'Confirmar exclusão' : 'Excluir'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.detalhe}>
              {dataBR(item.data)} · {moeda(item.valor_total)} ·{' '}
              {moeda(Number(item.valor_total) / Number(item.litros))}/L
            </Text>
            <Text style={styles.detalhe}>
              {item.nota_fiscal
                ? `NF ${item.nota_fiscal.numero} · ${item.nota_fiscal.fornecedor}`
                : 'Sem nota fiscal'}
            </Text>
          </View>
        )}
      />

      {/* Formulário de nova entrada */}
      <Modal visible={formAberto} animationType="slide" onRequestClose={fechar}>
        <ScrollView
          style={styles.modal}
          contentContainerStyle={styles.formConteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.titulo}>Nova entrada de combustível</Text>

          <Text style={styles.rotulo}>Tanque</Text>
          <View style={styles.opcoes}>
            {tanques.map((t) => (
              <Opcao
                key={t.id}
                texto={`${t.nome} · ${t.tipo_combustivel} (${litrosFmt(t.nivel_atual)} de ${litrosFmt(t.capacidade)} L)`}
                ativo={form.tanque_id === t.id}
                aoTocar={() => mudar('tanque_id', t.id)}
              />
            ))}
          </View>

          <Campo
            rotulo="Data (dd/mm/aaaa)"
            value={form.data}
            onChangeText={(v) => mudar('data', v)}
            maxLength={10}
          />
          <Campo
            rotulo="Litros"
            value={form.litros}
            onChangeText={(v) => mudar('litros', v)}
            keyboardType="decimal-pad"
          />
          <Campo
            rotulo="Valor total da compra (R$)"
            value={form.valor_total}
            onChangeText={(v) => mudar('valor_total', v)}
            keyboardType="decimal-pad"
          />

          <Text style={styles.secao}>Nota fiscal (opcional)</Text>
          <Campo
            rotulo="Número da nota"
            value={form.nf_numero}
            onChangeText={(v) => mudar('nf_numero', v)}
            maxLength={20}
          />
          <Campo
            rotulo="Fornecedor"
            value={form.nf_fornecedor}
            onChangeText={(v) => mudar('nf_fornecedor', v)}
          />
          <Campo
            rotulo="Chave de acesso (44 números)"
            value={form.nf_chave_acesso}
            onChangeText={(v) => mudar('nf_chave_acesso', v)}
            keyboardType="numeric"
            maxLength={54}
          />

          {erroForm && <Text style={styles.erroForm}>{erroForm}</Text>}

          <Pressable
            style={[styles.botao, salvando && styles.desativado]}
            onPress={salvar}
            disabled={salvando}
          >
            {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>Registrar</Text>}
          </Pressable>

          <Pressable style={styles.botaoSecundario} onPress={fechar} disabled={salvando}>
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subtitulo: { fontSize: 16, fontWeight: '600', color: '#374151' },
  botaoNovo: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  principal: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  excluir: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  excluirAtivo: { color: '#dc2626' },

  modal: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingTop: 56 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  secao: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 8, marginBottom: 10 },
  formConteudo: { paddingBottom: 40, width: '100%', maxWidth: 520, alignSelf: 'center' },
  grupo: { marginBottom: 12 },
  rotulo: { fontSize: 14, color: '#374151', marginBottom: 6, fontWeight: '500' },
  campo: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  opcao: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  opcaoAtiva: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
  erroForm: { color: '#dc2626', marginBottom: 12 },
  botao: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: '#374151', fontSize: 16, fontWeight: '600' },
});