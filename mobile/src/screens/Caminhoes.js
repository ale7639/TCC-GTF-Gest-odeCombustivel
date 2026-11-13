import { useCallback, useEffect, useMemo, useState } from 'react';
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
import SeletorLista from '../components/SeletorLista';
import EstadoVazio from '../ui/EstadoVazio';
import Esqueleto from '../ui/Esqueleto';
import MensagemErro from '../ui/MensagemErro';
import { useToast } from '../ui/Toast';
import { cartaoBase, RAIO_BOTAO, RAIO_CAMPO, RAIO_CARTAO, sombraSuave } from '../ui/tema';

const POR_PAGINA = 15;

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
  motorista_id: null, // null = sem motorista
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
  const toast = useToast();
  const [caminhoes, setCaminhoes] = useState([]);
  const [motoristas, setMotoristas] = useState([]); // usados para escolher o motorista do caminhão
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos' | 'ativo' | 'manutencao' | 'inativo'
  const [visiveis, setVisiveis] = useState(POR_PAGINA);

  // editando: null = formulário fechado | 'novo' = cadastrando | objeto = alterando aquele caminhão
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const [confirmando, setConfirmando] = useState(false); // pede um segundo toque para excluir

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      // As duas listas são buscadas ao mesmo tempo.
      const [listaCaminhoes, listaMotoristas] = await Promise.all([
        api('/caminhoes'),
        api('/motoristas'),
      ]);
      setCaminhoes(listaCaminhoes);
      setMotoristas(listaMotoristas);
    } catch (e) {
      setErro('Não foi possível carregar a frota. Verifique a conexão e se o servidor está ligado.');
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

  // Quantos caminhões há em cada situação (usado nos cartões do topo).
  const contagem = useMemo(
    () => ({
      todos: caminhoes.length,
      ativo: caminhoes.filter((c) => c.status === 'ativo').length,
      manutencao: caminhoes.filter((c) => c.status === 'manutencao').length,
      inativo: caminhoes.filter((c) => c.status === 'inativo').length,
    }),
    [caminhoes]
  );

  // Filtra a lista pela situação escolhida e pelo que foi digitado (placa, modelo ou motorista).
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return caminhoes.filter((c) => {
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
      if (!termo) return true;
      return (
        c.placa.toLowerCase().includes(termo) ||
        c.modelo.toLowerCase().includes(termo) ||
        (c.motorista?.nome ?? '').toLowerCase().includes(termo)
      );
    });
  }, [caminhoes, busca, filtroStatus]);

  useEffect(() => {
    setVisiveis(POR_PAGINA);
  }, [busca, filtroStatus, caminhoes]);

  const pagina = filtrados.slice(0, visiveis);
  const temMais = visiveis < filtrados.length;

  // Motoristas que podem ser escolhidos: ativos e sem caminhão, mais o que já conduz este caminhão.
  const motoristasDisponiveis = useMemo(() => {
    const idDele = editando && editando !== 'novo' ? editando.motorista_id : null;
    return motoristas.filter((m) => m.id === idDele || (m.ativo && !m.caminhao));
  }, [motoristas, editando]);

  // Opções do seletor (dropdown) de motorista — lista clara, igual aos outros formulários.
  const opcoesMotorista = useMemo(
    () => [
      { valor: null, rotulo: 'Nenhum' },
      ...motoristasDisponiveis.map((m) => ({ valor: m.id, rotulo: m.nome })),
    ],
    [motoristasDisponiveis]
  );

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
      motorista_id: c.motorista_id ?? null,
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
      motorista_id: form.motorista_id,
    };

    setSalvando(true);
    setErroForm(null);
    try {
      if (editando === 'novo') {
        await api('/caminhoes', { metodo: 'POST', corpo });
        toast.sucesso('Caminhão cadastrado.');
      } else {
        await api(`/caminhoes/${editando.id}`, { metodo: 'PUT', corpo });
        toast.sucesso('Caminhão atualizado.');
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
      toast.sucesso('Caminhão excluído.');
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
      <Cabecalho titulo="Frota">
        <Pressable
          style={({ pressed }) => [styles.botaoNovo, pressed && { opacity: 0.85 }]}
          onPress={abrirNovo}
        >
          <Text style={styles.botaoNovoTexto}>+ Novo</Text>
        </Pressable>
      </Cabecalho>

      <View style={styles.corpo}>
        {/* Cartões com o resumo da frota: tocar em um deles filtra a lista */}
        <View style={styles.cartoes}>
          {[
            ['todos', 'Total', '#dc2626'],
            ['ativo', 'Ativos', '#16a34a'],
            ['manutencao', 'Manutenção', '#d97706'],
            ['inativo', 'Inativos', '#6b7280'],
          ].map(([valor, rotulo, cor]) => (
            <Pressable
              key={valor}
              onPress={() => setFiltroStatus(valor)}
              style={({ pressed }) => [
                styles.cartaoFiltro,
                filtroStatus === valor && { borderColor: cor, borderWidth: 2 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.cartaoNumero, { color: cor }]}>{contagem[valor]}</Text>
              <Text style={styles.cartaoRotulo}>{rotulo}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.busca}
          placeholder="Buscar caminhão..."
          value={busca}
          onChangeText={setBusca}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {filtrados.length > 0 && (
          <Text style={styles.resumo}>
            Mostrando {pagina.length} de {filtrados.length}
          </Text>
        )}

        {erro && (
          <MensagemErro
            titulo="Erro ao carregar a frota"
            mensagem={erro}
            aoTentar={() => {
              setCarregando(true);
              carregar();
            }}
          />
        )}
        {carregando && !erro && <Esqueleto linhas={4} />}

        {!carregando && (
          <FlatList
            data={pagina}
            keyExtractor={(item) => String(item.id)}
            refreshControl={
              <RefreshControl
                refreshing={atualizando}
                onRefresh={() => {
                  setAtualizando(true);
                  carregar();
                }}
                tintColor="#dc2626"
              />
            }
            ListEmptyComponent={
              !erro ? (
                <EstadoVazio
                  icone="truck-outline"
                  titulo={
                    busca.trim() || filtroStatus !== 'todos'
                      ? 'Nenhum caminhão neste filtro'
                      : 'Nenhum caminhão cadastrado'
                  }
                  dica={
                    busca.trim() || filtroStatus !== 'todos'
                      ? 'Ajuste a busca ou o status, ou cadastre um novo.'
                      : 'Toque em + Novo para cadastrar o primeiro.'
                  }
                />
              ) : null
            }
            ListFooterComponent={
              temMais ? (
                <Pressable
                  style={({ pressed }) => [styles.maisBotao, pressed && { opacity: 0.85 }]}
                  onPress={() => setVisiveis((n) => n + POR_PAGINA)}
                >
                  <Text style={styles.maisTexto}>
                    Carregar mais ({pagina.length} de {filtrados.length})
                  </Text>
                </Pressable>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 88 }}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.caixa, pressed && styles.caixaPressionada]}
                onPress={() => abrirEdicao(item)}
              >
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
        )}
      </View>

      {/* Formulário de cadastro e edição */}
      <Modal visible={editando !== null} animationType="slide" onRequestClose={fechar}>
        <ScrollView
          style={styles.tela}
          contentContainerStyle={styles.formConteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Cabecalho
            titulo={editando === 'novo' ? 'Novo caminhão' : 'Editar caminhão'}
            aoVoltar={fechar}
            sangrar
          />

          <Campo
            rotulo="Placa"
            value={form.placa}
            onChangeText={(v) => mudar('placa', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))}
            placeholder="ABC1234 ou ABC1D23"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
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

          <SeletorLista
            rotulo="Motorista responsável"
            valor={form.motorista_id}
            opcoes={opcoesMotorista}
            aoMudar={(id) => mudar('motorista_id', id)}
            placeholder="Escolher motorista…"
            vazio="Nenhum motorista disponível no momento."
          />

          {erroForm && <Text style={styles.erroForm}>{erroForm}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.botao,
              salvando && styles.desativado,
              pressed && !salvando && styles.botaoPressionado,
            ]}
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
  tela: { flex: 1, backgroundColor: '#f3f4f6' },
  corpo: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  cartoes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cartaoFiltro: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: RAIO_CARTAO,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 10,
    alignItems: 'center',
    ...sombraSuave,
  },
  cartaoNumero: { fontSize: 20, fontWeight: '700' },
  cartaoRotulo: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  botaoNovo: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 14 },
  busca: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CAMPO,
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    outlineStyle: 'none',
    ...sombraSuave,
  },
  resumo: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  maisBotao: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CAMPO,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
    ...sombraSuave,
  },
  maisTexto: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
  caixa: { ...cartaoBase },
  caixaPressionada: { opacity: 0.82 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  placa: { fontSize: 17, fontWeight: '700', color: '#1f2937' },
  modelo: { fontSize: 15, color: '#1f2937', marginTop: 4 },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  etiqueta: { borderRadius: 8, paddingVertical: 3, paddingHorizontal: 10 },
  etiquetaTexto: { fontSize: 12, fontWeight: '600' },

  formConteudo: {
    paddingBottom: 40,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  grupo: { marginBottom: 12 },
  rotulo: { fontSize: 14, color: '#374151', marginBottom: 6, fontWeight: '500' },
  campo: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: RAIO_CAMPO,
    padding: 12,
    fontSize: 16,
  },
  opcoes: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  opcao: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: RAIO_CAMPO,
    paddingVertical: 10,
    alignItems: 'center',
  },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
  erroForm: { color: '#dc2626', marginBottom: 12 },
  botao: { backgroundColor: '#dc2626', borderRadius: RAIO_BOTAO, padding: 14, alignItems: 'center' },
  botaoPressionado: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: '#374151', fontSize: 16, fontWeight: '600' },
  botaoExcluir: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: RAIO_BOTAO,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  botaoExcluirAtivo: { backgroundColor: '#dc2626' },
  botaoExcluirTexto: { color: '#dc2626', fontSize: 15, fontWeight: '600' },
});
