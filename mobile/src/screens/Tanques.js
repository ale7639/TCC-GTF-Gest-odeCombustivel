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
import { mascaraMoeda, moedaParaNumero } from '../utils/formatos';
import Cabecalho from '../components/Cabecalho';
import Moldura from '../ui/Moldura';
import Entradas from './Entradas';
import { cores } from '../ui/tema';

// Funções de formatação: 15000 -> "15.000" | "273.50" -> "273,5"
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const litrosFmt = (n) => {
  const [inteiro, decimal] = String(Number(n)).split('.');
  return separar(inteiro) + (decimal ? `,${decimal}` : '');
};
const moedaL = (n) => 'R$ ' + Number(n).toFixed(2).replace('.', ',') + '/L';
const percentual = (t) =>
  Number(t.capacidade) > 0 ? (Number(t.nivel_atual) / Number(t.capacidade)) * 100 : 0;

// Mensagem amigável para qualquer erro de comunicação com a API.
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

// Tipos de combustível aceitos. É uma lista FECHADA: o usuário só escolhe nos botões.
// Precisa ser igual à lista TIPOS_COMBUSTIVEL do TanqueController (o backend confere de novo).
const TIPOS = ['Diesel S10', 'Diesel S500', 'Gasolina comum', 'Gasolina aditivada', 'Etanol'];

// Capacidade: número inteiro de litros, na mesma faixa do backend.
const CAPACIDADE_MIN = 100;
const CAPACIDADE_MAX = 100000;
// Deixa só os números (tira vírgula, ponto, letras...). \D = qualquer coisa que não seja dígito.
const soNumeros = (v) => v.replace(/\D/g, '');

// Formulário em branco para um tanque novo.
const formVazio = () => ({
  nome: '',
  tipo_combustivel: '',
  capacidade: '',
  nivel_atual: '0',
  custo_litro_inicial: '',
  principal: false,
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

export default function Tanques() {
  const [aba, setAba] = useState('tanques'); // 'tanques' | 'entradas' | 'abastecidas'
  const [tanques, setTanques] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);

  // editando: null = formulário fechado | 'novo' = cadastrando | objeto = alterando aquele tanque
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const [confirmando, setConfirmando] = useState(false); // pede um segundo toque para excluir

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setTanques(await api('/tanques'));
    } catch (e) {
      setErro('Não foi possível carregar os tanques. Verifique se o servidor está ligado.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  // Recarrega toda vez que a aba é aberta (os níveis mudam a cada abastecimento).
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar, aba])
  );

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const abrirNovo = () => {
    setForm(formVazio());
    setErroForm(null);
    setConfirmando(false);
    setEditando('novo');
  };

  const abrirEdicao = (t) => {
    setForm({
      nome: t.nome,
      tipo_combustivel: t.tipo_combustivel,
      // O banco guarda "1000.00": Math.round deixa "1000" no campo (que só aceita inteiro).
      capacidade: String(Math.round(Number(t.capacidade))),
      nivel_atual: String(Number(t.nivel_atual)),
      principal: Boolean(t.principal),
    });
    setErroForm(null);
    setConfirmando(false);
    setEditando(t);
  };

  const fechar = () => {
    setEditando(null);
    setErroForm(null);
    setConfirmando(false);
  };

  const salvar = async () => {
    const capacidade = Number(form.capacidade); // o campo já só tem números inteiros
    const nivel = Number(String(form.nivel_atual || '0').replace(',', '.'));

    if (!form.nome.trim()) {
      setErroForm('Preencha o nome do tanque.');
      return;
    }
    // includes = confere se o tipo escolhido está na lista (um tanque antigo com
    // um tipo que saiu da lista, como "Gasolina", precisa escolher de novo).
    if (!TIPOS.includes(form.tipo_combustivel)) {
      setErroForm('Escolha o tipo de combustível.');
      return;
    }
    if (form.capacidade === '' || capacidade < CAPACIDADE_MIN || capacidade > CAPACIDADE_MAX) {
      setErroForm('A capacidade deve ficar entre 100 e 100.000 litros.');
      return;
    }
    if (editando === 'novo' && Number.isNaN(nivel)) {
      setErroForm('Nível inicial inválido.');
      return;
    }

    const custoInicial = form.custo_litro_inicial ? moedaParaNumero(form.custo_litro_inicial) : 0;
    if (editando === 'novo' && (Number.isNaN(custoInicial) || custoInicial < 0)) {
      setErroForm('Custo por litro inválido.');
      return;
    }

    const corpo = {
      nome: form.nome.trim(),
      tipo_combustivel: form.tipo_combustivel.trim(),
      capacidade,
      principal: form.principal,
    };
    // O nível só é enviado no cadastro. Depois ele muda sozinho (entradas e abastecimentos).
    if (editando === 'novo') {
      corpo.nivel_atual = nivel;
      corpo.custo_litro_inicial = custoInicial;
    }

    setSalvando(true);
    setErroForm(null);
    try {
      if (editando === 'novo') {
        await api('/tanques', { metodo: 'POST', corpo });
      } else {
        await api(`/tanques/${editando.id}`, { metodo: 'PUT', corpo });
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
      await api(`/tanques/${editando.id}`, { metodo: 'DELETE' });
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
      <Cabecalho titulo="Tanques">
        {aba === 'tanques' && (
          <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
            <Text style={styles.botaoNovoTexto}>+ Novo</Text>
          </Pressable>
        )}
      </Cabecalho>

      <View style={styles.corpo}>
        <View style={styles.segmentos}>
          {[
            ['tanques', 'Tanques'],
            ['entradas', 'Entradas'],
            ['abastecidas', 'Abastecidas'],
          ].map(([valor, rotulo]) => (
            <Pressable
              key={valor}
              onPress={() => setAba(valor)}
              style={[styles.segmento, aba === valor && styles.segmentoAtivo]}
            >
              <Text style={[styles.segmentoTexto, aba === valor && { color: '#fff' }]}>{rotulo}</Text>
            </Pressable>
          ))}
        </View>

        {aba === 'entradas' && <Entradas />}
        {aba === 'abastecidas' && <Abastecimentos embutido />}

        {aba === 'tanques' && (
          <>
            {erro && <Text style={styles.erro}>{erro}</Text>}
            {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

            <FlatList
              data={tanques}
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
                !carregando && !erro ? <Text style={styles.vazio}>Nenhum tanque cadastrado.</Text> : null
              }
              contentContainerStyle={{ paddingBottom: 88 }}
              renderItem={({ item }) => {
                const pct = percentual(item);
                const baixo = pct < 20;
                return (
                  <Pressable style={styles.caixa} onPress={() => abrirEdicao(item)}>
                    <View style={styles.topo}>
                      <Text style={styles.nomeItem}>
                        {item.nome} · {item.tipo_combustivel}
                        {item.principal ? ' · Principal' : ''}
                      </Text>
                      {baixo && <Text style={styles.alerta}>Nível baixo</Text>}
                    </View>
                    <View style={styles.barraFundo}>
                      <View
                        style={[
                          styles.barra,
                          { width: `${Math.min(pct, 100)}%`, backgroundColor: baixo ? '#dc2626' : '#16a34a' },
                        ]}
                      />
                    </View>
                    <Text style={styles.detalhe}>
                      {litrosFmt(item.nivel_atual)} L de {litrosFmt(item.capacidade)} L ({pct.toFixed(1).replace('.', ',')}%)
                    </Text>
                    {baixo && <Text style={styles.alerta}>NÍVEL BAIXO</Text>}
                  </View>
                  <View style={styles.barraFundo}>
                    <View
                      style={[
                        styles.barra,
                        { width: `${Math.min(pct, 100)}%`, backgroundColor: baixo ? cores.perigo : cores.primaria },
                      ]}
                    />
                  </View>
                  <Text style={styles.detalhe}>
                    {litrosFmt(item.nivel_atual)} L de {litrosFmt(item.capacidade)} L ({pct.toFixed(1).replace('.', ',')}%)
                  </Text>
                  <Text style={styles.custo}>
                    Custo médio: {item.custo_medio != null ? moedaL(item.custo_medio) : '—'}
                  </Text>
                </Pressable>
              );
            }}
          />
        </>
      )}

      {/* Formulário de cadastro e edição */}
      <Modal visible={editando !== null} animationType="slide" onRequestClose={fechar}>
        <Moldura>
        <ScrollView
          style={styles.tela}
          contentContainerStyle={styles.formConteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Cabecalho titulo={editando === 'novo' ? 'Novo tanque' : 'Editar tanque'} aoVoltar={fechar} />

          <Campo rotulo="Nome" value={form.nome} onChangeText={(v) => mudar('nome', v)} />

          {/* Tipo de combustível: só os botões (não tem mais campo de texto livre) */}
          <Text style={styles.rotulo}>Tipo de combustível</Text>
          <View style={styles.opcoes}>
            {TIPOS.map((tipo) => (
              <Pressable
                key={tipo}
                onPress={() => mudar('tipo_combustivel', tipo)}
                style={[styles.opcao, form.tipo_combustivel === tipo && styles.opcaoAtiva]}
              >
                <Text style={[styles.opcaoTexto, form.tipo_combustivel === tipo && { color: '#fff' }]}>
                  {tipo}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Capacidade: só números inteiros (soNumeros tira vírgula e ponto enquanto digita) */}
          <Campo
            rotulo="Capacidade (100 a 100.000 litros)"
            value={form.capacidade}
            onChangeText={(v) => mudar('capacidade', soNumeros(v))}
            placeholder="Ex.: 15000"
            keyboardType="numeric"
            maxLength={6}
          />

          {editando === 'novo' ? (
            <>
              <Campo
                rotulo="Nível inicial (litros)"
                value={form.nivel_atual}
                onChangeText={(v) => mudar('nivel_atual', v)}
                keyboardType="decimal-pad"
              />
              <Campo
                rotulo="Custo do nível inicial (por litro)"
                placeholder="R$ 0,00"
                value={form.custo_litro_inicial}
                onChangeText={(v) => mudar('custo_litro_inicial', mascaraMoeda(v))}
                keyboardType="numeric"
              />
            </>
          ) : (
            <View style={styles.grupo}>
              <Text style={styles.rotulo}>Nível atual</Text>
              <Text style={styles.somenteLeitura}>
                {litrosFmt(form.nivel_atual)} L (muda com as entradas e os abastecimentos)
              </Text>
            </View>
          )}

          <Text style={styles.rotulo}>Tanque principal da base?</Text>
          <View style={styles.opcoes}>
            {[
              [true, 'Sim'],
              [false, 'Não'],
            ].map(([valor, rotulo]) => (
              <Pressable
                key={rotulo}
                onPress={() => mudar('principal', valor)}
                style={[styles.opcao, form.principal === valor && styles.opcaoAtiva]}
              >
                <Text style={[styles.opcaoTexto, form.principal === valor && { color: '#fff' }]}>
                  {rotulo}
                </Text>
              </Pressable>
            ))}
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
                {confirmando ? 'Toque de novo para confirmar a exclusão' : 'Excluir tanque'}
              </Text>
            </Pressable>
          )}
        </ScrollView>
        </Moldura>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 16, paddingTop: 56 },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titulo: { fontSize: 24, fontWeight: 'bold', color: cores.texto, marginBottom: 4 },
  tituloTela: { fontSize: 20, fontWeight: 'bold', color: cores.texto, flexShrink: 1, marginRight: 8 },
  botaoNovo: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
  segmentos: {
    flexDirection: 'row',
    backgroundColor: cores.bordaClara,
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  segmento: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  segmentoAtivo: { backgroundColor: cores.primaria },
  segmentoTexto: { fontSize: 14, fontWeight: '600', color: cores.textoMedio },
  erro: { color: cores.perigo, marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: cores.textoSecundario, marginTop: 40 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  nomeItem: { fontSize: 15, fontWeight: '600', color: cores.texto },
  alerta: { color: cores.perigo, fontWeight: 'bold', fontSize: 12 },
  barraFundo: { height: 10, backgroundColor: cores.bordaClara, borderRadius: 5, overflow: 'hidden' },
  barra: { height: 10 },
  detalhe: { fontSize: 13, color: cores.textoSecundario, marginTop: 6 },
  custo: { fontSize: 13, color: cores.primaria, marginTop: 4, fontWeight: '500' },

  formConteudo: {
    paddingBottom: 40,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  grupo: { marginBottom: 12 },
  rotulo: { fontSize: 14, color: cores.textoMedio, marginBottom: 6, fontWeight: '500' },
  campo: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  somenteLeitura: { fontSize: 15, color: cores.texto },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  opcao: {
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  opcaoAtiva: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  opcaoTexto: { fontSize: 13, fontWeight: '600', color: cores.textoMedio },
  erroForm: { color: cores.perigo, marginBottom: 12 },
  botao: { backgroundColor: cores.primaria, borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: cores.textoMedio, fontSize: 16, fontWeight: '600' },
  botaoExcluir: {
    borderWidth: 1,
    borderColor: cores.perigo,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  botaoExcluirAtivo: { backgroundColor: cores.perigo },
  botaoExcluirTexto: { color: cores.perigo, fontSize: 15, fontWeight: '600' },
});