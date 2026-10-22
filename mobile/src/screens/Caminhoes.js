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

// 15000 -> "15.000"
const numero = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Mensagem amigável para qualquer erro de comunicação com a API.
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

// Os três status possíveis, com o texto e a cor de cada um.
const STATUS = [
  { valor: 'ativo', rotulo: 'Ativo', cor: '#16a34a' },
  { valor: 'manutencao', rotulo: 'Manutenção', cor: '#d97706' },
  { valor: 'inativo', rotulo: 'Inativo', cor: '#6b7280' },
];
const infoStatus = (valor) => STATUS.find((s) => s.valor === valor) ?? STATUS[2];

// Formulário em branco para um caminhão novo.
const formVazio = () => ({
  placa: '',
  modelo: '',
  ano: String(new Date().getFullYear()),
  capacidade_tanque: '',
  km_atual: '0',
  status: 'ativo',
});

// Etiqueta colorida com o status.
function Etiqueta({ status }) {
  const { rotulo, cor } = infoStatus(status);
  return (
    <View style={[styles.etiqueta, { backgroundColor: `${cor}22` }]}>
      <Text style={[styles.etiquetaTexto, { color: cor }]}>{rotulo}</Text>
    </View>
  );
}

// Campo de texto com rótulo em cima.
function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
    </View>
  );
}

export default function Caminhoes() {
  const [caminhoes, setCaminhoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');

  // editando: null = formulário fechado | 'novo' = cadastrando | objeto = alterando aquele caminhão
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const [confirmando, setConfirmando] = useState(false); // pede um segundo toque para excluir

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setCaminhoes(await api('/caminhoes'));
    } catch (e) {
      setErro('Não foi possível carregar os caminhões. Verifique se o servidor está ligado.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  // Recarrega a lista toda vez que a aba é aberta.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  // Filtra a lista pelo que foi digitado na busca (placa ou modelo).
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return caminhoes;
    return caminhoes.filter(
      (c) => c.placa.toLowerCase().includes(termo) || c.modelo.toLowerCase().includes(termo)
    );
  }, [caminhoes, busca]);

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const abrirNovo = () => {
    setForm(formVazio());
    setErroForm(null);
    setConfirmando(false);
    setEditando('novo');
  };

  const abrirEdicao = (c) => {
    setForm({
      placa: c.placa,
      modelo: c.modelo,
      ano: String(c.ano),
      capacidade_tanque: String(Number(c.capacidade_tanque)),
      km_atual: String(c.km_atual),
      status: c.status,
    });
    setErroForm(null);
    setConfirmando(false);
    setEditando(c);
  };

  const fechar = () => {
    setEditando(null);
    setErroForm(null);
    setConfirmando(false);
  };

  const salvar = async () => {
    if (!form.placa.trim() || !form.modelo.trim() || !form.ano || !form.capacidade_tanque || form.km_atual === '') {
      setErroForm('Preencha todos os campos.');
      return;
    }

    const corpo = {
      placa: form.placa.trim(),
      modelo: form.modelo.trim(),
      ano: Number(form.ano),
      capacidade_tanque: Number(String(form.capacidade_tanque).replace(',', '.')),
      km_atual: Number(form.km_atual),
      status: form.status,
    };

    setSalvando(true);
    setErroForm(null);
    try {
      if (editando === 'novo') {
        await api('/caminhoes', { metodo: 'POST', corpo });
      } else {
        await api(`/caminhoes/${editando.id}`, { metodo: 'PUT', corpo });
      }
      fechar();
      await carregar();
    } catch (e) {
      setErroForm(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    // Primeiro toque: pede confirmação. Segundo toque: exclui.
    if (!confirmando) {
      setConfirmando(true);
      return;
    }

    setSalvando(true);
    setErroForm(null);
    try {
      await api(`/caminhoes/${editando.id}`, { metodo: 'DELETE' });
      fechar();
      await carregar();
    } catch (e) {
      setErroForm(mensagemDe(e));
      setConfirmando(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <View style={styles.tela}>
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>Caminhões</Text>
        <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
          <Text style={styles.botaoNovoTexto}>+ Novo</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.busca}
        placeholder="Buscar por placa ou modelo"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      <FlatList
        data={filtrados}
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
          !carregando && !erro ? <Text style={styles.vazio}>Nenhum caminhão encontrado.</Text> : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable style={styles.caixa} onPress={() => abrirEdicao(item)}>
            <View style={styles.topo}>
              <Text style={styles.placa}>{item.placa}</Text>
              <Etiqueta status={item.status} />
            </View>
            <Text style={styles.modelo}>
              {item.modelo} · {item.ano}
            </Text>
            <Text style={styles.detalhe}>
              {numero(item.km_atual)} km · tanque de {numero(item.capacidade_tanque)} L
            </Text>
            <Text style={styles.detalhe}>Motorista: {item.motorista?.nome ?? 'sem motorista'}</Text>
          </Pressable>
        )}
      />

      {/* Formulário de cadastro e edição */}
      <Modal visible={editando !== null} animationType="slide" onRequestClose={fechar}>
        <ScrollView
          style={styles.tela}
          contentContainerStyle={styles.formConteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.titulo}>{editando === 'novo' ? 'Novo caminhão' : 'Editar caminhão'}</Text>

          <Campo
            rotulo="Placa"
            value={form.placa}
            onChangeText={(v) => mudar('placa', v)}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
          />
          <Campo rotulo="Modelo" value={form.modelo} onChangeText={(v) => mudar('modelo', v)} />
          <Campo
            rotulo="Ano"
            value={form.ano}
            onChangeText={(v) => mudar('ano', v)}
            keyboardType="numeric"
            maxLength={4}
          />
          <Campo
            rotulo="Capacidade do tanque (litros)"
            value={form.capacidade_tanque}
            onChangeText={(v) => mudar('capacidade_tanque', v)}
            keyboardType="decimal-pad"
          />
          <Campo
            rotulo="Quilometragem atual"
            value={form.km_atual}
            onChangeText={(v) => mudar('km_atual', v)}
            keyboardType="numeric"
          />

          <Text style={styles.rotulo}>Status</Text>
          <View style={styles.opcoes}>
            {STATUS.map((s) => {
              const ativo = form.status === s.valor;
              return (
                <Pressable
                  key={s.valor}
                  onPress={() => mudar('status', s.valor)}
                  style={[
                    styles.opcao,
                    ativo && { backgroundColor: s.cor, borderColor: s.cor },
                  ]}
                >
                  <Text style={[styles.opcaoTexto, ativo && { color: '#fff' }]}>{s.rotulo}</Text>
                </Pressable>
              );
            })}
          </View>

          {erroForm && <Text style={styles.erroForm}>{erroForm}</Text>}

          <Pressable
            style={[styles.botao, salvando && styles.desativado]}
            onPress={salvar}
            disabled={salvando}
          >
            {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>Salvar</Text>}
          </Pressable>

          <Pressable style={styles.botaoSecundario} onPress={fechar} disabled={salvando}>
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>

          {editando !== 'novo' && editando !== null && (
            <Pressable
              style={[styles.botaoExcluir, confirmando && styles.botaoExcluirAtivo]}
              onPress={excluir}
              disabled={salvando}
            >
              <Text style={[styles.botaoExcluirTexto, confirmando && { color: '#fff' }]}>
                {confirmando ? 'Toque de novo para confirmar a exclusão' : 'Excluir caminhão'}
              </Text>
            </Pressable>
          )}
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
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  botaoNovo: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
  busca: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  placa: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  modelo: { fontSize: 15, color: '#111827', marginTop: 4 },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  etiqueta: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  etiquetaTexto: { fontSize: 12, fontWeight: '600' },

  formConteudo: { paddingBottom: 40 },
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
  opcoes: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  opcao: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
  erroForm: { color: '#dc2626', marginBottom: 12 },
  botao: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: '#374151', fontSize: 16, fontWeight: '600' },
  botaoExcluir: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  botaoExcluirAtivo: { backgroundColor: '#dc2626' },
  botaoExcluirTexto: { color: '#dc2626', fontSize: 15, fontWeight: '600' },
});