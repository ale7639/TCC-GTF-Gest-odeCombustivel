import { useCallback, useMemo, useState } from 'react';
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
import Cabecalho from '../components/Cabecalho';

// Funções de formatação.
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));                 // 15000 -> "15.000"
const litrosFmt = (n) => {                                            // "273.50" -> "273,5"
  const [inteiro, decimal] = String(Number(n)).split('.');
  return separar(inteiro) + (decimal ? `,${decimal}` : '');
};
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

// Formulário em branco para um abastecimento novo.
const formVazio = () => ({
  caminhao_id: null,
  tanque_id: null,
  litros: '',
  km: '',
  data: hoje(),
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

// Botão de escolha (usado para caminhão e tanque).
function Opcao({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.opcao, ativo && styles.opcaoAtiva]}>
      <Text style={[styles.opcaoTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

export default function Abastecimentos() {
  const [abastecimentos, setAbastecimentos] = useState([]);
  const [caminhoes, setCaminhoes] = useState([]);
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
      // As três listas são buscadas ao mesmo tempo.
      const [listaAbast, listaCaminhoes, listaTanques] = await Promise.all([
        api('/abastecimentos'),
        api('/caminhoes'),
        api('/tanques'),
      ]);
      setAbastecimentos(listaAbast);
      setCaminhoes(listaCaminhoes);
      setTanques(listaTanques);
    } catch (e) {
      setErro('Não foi possível carregar os abastecimentos. Verifique se o servidor está ligado.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  // Recarrega toda vez que a aba é aberta (os níveis dos tanques mudam a cada abastecimento).
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  // Só caminhões ativos e com motorista responsável podem ser abastecidos.
  const caminhoesDisponiveis = useMemo(
    () => caminhoes.filter((c) => c.status === 'ativo' && c.motorista_id),
    [caminhoes]
  );

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  // Ao escolher o caminhão, já sugere a quilometragem atual dele.
  const escolherCaminhao = (c) =>
    setForm((atual) => ({ ...atual, caminhao_id: c.id, km: String(c.km_atual) }));

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
    const km = Number(form.km);
    const data = paraISO(form.data);

    if (!form.caminhao_id || !form.tanque_id) {
      setErroForm('Escolha o caminhão e o tanque.');
      return;
    }
    if (!(litros > 0)) {
      setErroForm('Informe a quantidade de litros.');
      return;
    }
    if (form.km === '' || Number.isNaN(km)) {
      setErroForm('Informe a quilometragem.');
      return;
    }
    if (!data) {
      setErroForm('Informe a data no formato dd/mm/aaaa.');
      return;
    }

    setSalvando(true);
    setErroForm(null);
    try {
      await api('/abastecimentos', {
        metodo: 'POST',
        corpo: { caminhao_id: form.caminhao_id, tanque_id: form.tanque_id, litros, km, data },
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
      await api(`/abastecimentos/${id}`, { metodo: 'DELETE' });
      setConfirmandoId(null);
      await carregar();
    } catch (e) {
      setErro(mensagemDe(e));
      setConfirmandoId(null);
    }
  };

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="ABASTECIMENTOS">
        <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
          <Text style={styles.botaoNovoTexto}>+ Novo</Text>
        </Pressable>
      </Cabecalho>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      <FlatList
        data={abastecimentos}
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
          !carregando && !erro ? <Text style={styles.vazio}>Nenhum abastecimento registrado.</Text> : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.caixa}>
            <View style={styles.topo}>
              <Text style={styles.principal}>
                {item.caminhao.placa} · {litrosFmt(item.litros)} L
              </Text>
              <Pressable onPress={() => excluir(item.id)}>
                <Text style={[styles.excluir, confirmandoId === item.id && styles.excluirAtivo]}>
                  {confirmandoId === item.id ? 'Confirmar exclusão' : 'Excluir'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.detalhe}>
              {item.motorista.nome} · {item.tanque.nome}
            </Text>
            <Text style={styles.detalhe}>
              {dataBR(item.data)} · {numero(item.km)} km
            </Text>
          </View>
        )}
      />

      {/* Formulário de novo abastecimento */}
      <Modal visible={formAberto} animationType="slide" onRequestClose={fechar}>
        <ScrollView
          style={styles.tela}
          contentContainerStyle={styles.formConteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.titulo}>Novo abastecimento</Text>

          <Text style={styles.rotulo}>Caminhão</Text>
          <View style={styles.opcoes}>
            {caminhoesDisponiveis.length === 0 && (
              <Text style={styles.aviso}>Nenhum caminhão ativo com motorista responsável.</Text>
            )}
            {caminhoesDisponiveis.map((c) => (
              <Opcao
                key={c.id}
                texto={`${c.placa} · ${c.motorista?.nome ?? ''}`}
                ativo={form.caminhao_id === c.id}
                aoTocar={() => escolherCaminhao(c)}
              />
            ))}
          </View>

          <Text style={styles.rotulo}>Tanque de origem</Text>
          <View style={styles.opcoes}>
            {tanques.map((t) => (
              <Opcao
                key={t.id}
                texto={`${t.nome} · ${t.tipo_combustivel} (${litrosFmt(t.nivel_atual)} L)`}
                ativo={form.tanque_id === t.id}
                aoTocar={() => mudar('tanque_id', t.id)}
              />
            ))}
          </View>

          <Campo
            rotulo="Litros"
            value={form.litros}
            onChangeText={(v) => mudar('litros', v)}
            keyboardType="decimal-pad"
          />
          <Campo
            rotulo="Quilometragem do caminhão"
            value={form.km}
            onChangeText={(v) => mudar('km', v)}
            keyboardType="numeric"
          />
          <Campo
            rotulo="Data (dd/mm/aaaa)"
            value={form.data}
            onChangeText={(v) => mudar('data', v)}
            maxLength={10}
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
  tela: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingTop: 56 },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  botaoNovo: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  principal: { fontSize: 17, fontWeight: 'bold', color: '#111827' },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  excluir: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  excluirAtivo: { color: '#dc2626' },

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
  aviso: { color: '#6b7280' },
  erroForm: { color: '#dc2626', marginBottom: 12 },
  botao: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: '#374151', fontSize: 16, fontWeight: '600' },
});