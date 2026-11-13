import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Linking,
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
import { linkWhatsApp, mascaraCPF, mascaraTelefone, somenteDigitos } from '../utils/formatos';

const POR_PAGINA = 15;

// Mensagem amigável para qualquer erro de comunicação com a API.
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

// Formulário em branco para um motorista novo.
const formVazio = () => ({
  nome: '',
  cpf: '',
  cnh: '',
  telefone: '',
  ativo: true,
  caminhao_id: null, // null = sem caminhão
  acesso_senha: '', // login = CPF; senha definida/redefinida pelo ADM
});

// Etiqueta colorida: verde para ativo, cinza para inativo.
function Etiqueta({ ativo }) {
  const cor = ativo ? '#16a34a' : '#6b7280';
  return (
    <View style={[styles.etiqueta, { backgroundColor: `${cor}22` }]}>
      <Text style={[styles.etiquetaTexto, { color: cor }]}>{ativo ? 'Ativo' : 'Inativo'}</Text>
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

// Botão de escolha (usado para status e para o caminhão).
function Opcao({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.opcao, ativo && styles.opcaoAtiva]}>
      <Text style={[styles.opcaoTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

export default function Motoristas() {
  const [motoristas, setMotoristas] = useState([]);
  const [caminhoes, setCaminhoes] = useState([]); // usados para escolher o caminhão do motorista
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [visiveis, setVisiveis] = useState(POR_PAGINA);

  // editando: null = formulário fechado | 'novo' = cadastrando | objeto = alterando aquele motorista
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const [confirmando, setConfirmando] = useState(false); // pede um segundo toque para excluir

  // O motorista em edição já tem login? (muda o texto do campo de senha)
  const [temAcesso, setTemAcesso] = useState(false);
  const [msgAcesso, setMsgAcesso] = useState(null); // { texto, erro } — aviso da remoção do acesso

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      // As duas listas são buscadas ao mesmo tempo.
      const [listaMotoristas, listaCaminhoes] = await Promise.all([
        api('/motoristas'),
        api('/caminhoes'),
      ]);
      setMotoristas(listaMotoristas);
      setCaminhoes(listaCaminhoes);
    } catch (e) {
      setErro('Não foi possível carregar os motoristas. Verifique se o servidor está ligado.');
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

  // Filtra a lista pelo que foi digitado na busca (nome ou CPF).
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return motoristas;
    return motoristas.filter(
      (m) => m.nome.toLowerCase().includes(termo) || m.cpf.includes(termo)
    );
  }, [motoristas, busca]);

  useEffect(() => {
    setVisiveis(POR_PAGINA);
  }, [busca, motoristas]);

  const pagina = filtrados.slice(0, visiveis);
  const temMais = visiveis < filtrados.length;

  // Caminhões que podem ser escolhidos: os sem motorista e o que já é deste motorista.
  const caminhoesDisponiveis = useMemo(() => {
    const idDele = editando && editando !== 'novo' ? editando.id : null;
    return caminhoes.filter((c) => !c.motorista_id || c.motorista_id === idDele);
  }, [caminhoes, editando]);

  const opcoesCaminhao = useMemo(
    () => [
      { valor: null, rotulo: 'Nenhum' },
      ...caminhoesDisponiveis.map((c) => ({
        valor: c.id,
        rotulo: `${c.placa} · ${c.modelo}`,
      })),
    ],
    [caminhoesDisponiveis]
  );

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const abrirNovo = () => {
    setForm(formVazio());
    setErroForm(null);
    setConfirmando(false);
    setTemAcesso(false);
    setMsgAcesso(null);
    setEditando('novo');
  };

  const abrirEdicao = (m) => {
    setForm({
      nome: m.nome,
      cpf: m.cpf,
      cnh: m.cnh,
      telefone: m.telefone ?? '',
      ativo: Boolean(m.ativo),
      caminhao_id: m.caminhao?.id ?? null,
      acesso_senha: '',
    });
    setErroForm(null);
    setConfirmando(false);
    setTemAcesso(Boolean(m.tem_acesso ?? m.acesso_email));
    setMsgAcesso(null);
    setEditando(m);
  };

  const fechar = () => {
    setEditando(null);
    setErroForm(null);
    setConfirmando(false);
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.cpf.trim() || !form.cnh.trim()) {
      setErroForm('Preencha nome, CPF e CNH.');
      return;
    }
    if (somenteDigitos(form.cpf).length !== 11) {
      setErroForm('CPF incompleto. Exemplo: 096.668.979-89');
      return;
    }
    if (somenteDigitos(form.telefone).length !== 11) {
      setErroForm('Informe o celular com DDD. Exemplo: 44 98751-3965');
      return;
    }
    if (somenteDigitos(form.cnh).length !== 11) {
      setErroForm('A CNH deve ter 11 números.');
      return;
    }
    if (form.acesso_senha && form.acesso_senha.length < 6) {
      setErroForm('A senha precisa ter pelo menos 6 caracteres (ou deixe em branco).');
      return;
    }

    const corpo = {
      nome: form.nome.trim(),
      cpf: form.cpf.trim(),
      cnh: form.cnh.trim(),
      telefone: form.telefone.trim(),
      ativo: form.ativo,
      caminhao_id: form.caminhao_id,
      acesso_senha: form.acesso_senha || null,
    };

    setSalvando(true);
    setErroForm(null);
    try {
      if (editando === 'novo') {
        await api('/motoristas', { metodo: 'POST', corpo });
      } else {
        await api(`/motoristas/${editando.id}`, { metodo: 'PUT', corpo });
      }
      fechar();
      await carregar();
    } catch (e) {
      setErroForm(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  const removerAcesso = async () => {
    setSalvando(true);
    setMsgAcesso(null);
    try {
      await api(`/motoristas/${editando.id}/acesso`, { metodo: 'DELETE' });
      setTemAcesso(false);
      setForm((atual) => ({ ...atual, acesso_senha: '' }));
      setMsgAcesso({ texto: 'Acesso removido.', erro: false });
      carregar();
    } catch (e) {
      setMsgAcesso({ texto: mensagemDe(e), erro: true });
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
      await api(`/motoristas/${editando.id}`, { metodo: 'DELETE' });
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
      <Cabecalho titulo="Motoristas">
        <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
          <Text style={styles.botaoNovoTexto}>+ Novo</Text>
        </Pressable>
      </Cabecalho>

      <View style={styles.corpo}>
        <TextInput
          style={styles.busca}
          placeholder="Buscar por nome ou CPF"
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

        {erro && <Text style={styles.erro}>{erro}</Text>}
        {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

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
            />
          }
          ListEmptyComponent={
            !carregando && !erro ? <Text style={styles.vazio}>Nenhum motorista encontrado.</Text> : null
          }
          ListFooterComponent={
            temMais ? (
              <Pressable style={styles.maisBotao} onPress={() => setVisiveis((n) => n + POR_PAGINA)}>
                <Text style={styles.maisTexto}>
                  Carregar mais ({pagina.length} de {filtrados.length})
                </Text>
              </Pressable>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 88 }}
          renderItem={({ item }) => (
            <Pressable style={styles.caixa} onPress={() => abrirEdicao(item)}>
              <View style={styles.topo}>
                <Text style={styles.nome}>{item.nome}</Text>
                <Etiqueta ativo={Boolean(item.ativo)} />
              </View>
              <Text style={styles.detalhe}>
                CPF {item.cpf} · CNH {item.cnh}
              </Text>
              {item.telefone ? <Text style={styles.detalhe}>{item.telefone}</Text> : null}
              {linkWhatsApp(item.telefone) && (
                <Pressable
                  style={styles.whats}
                  onPress={() => Linking.openURL(linkWhatsApp(item.telefone, `Olá, ${item.nome.split(' ')[0]}!`))}
                >
                  <Text style={styles.whatsTexto}>Conversar no WhatsApp</Text>
                </Pressable>
              )}
              <Text style={styles.detalhe}>
                Caminhão: {item.caminhao ? `${item.caminhao.placa} · ${item.caminhao.modelo}` : 'sem caminhão'}
              </Text>
              <Text style={styles.detalhe}>
                Acesso: {item.tem_acesso || item.acesso_email ? `CPF ${item.cpf}` : 'sem login'}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Formulário de cadastro e edição */}
      <Modal visible={editando !== null} animationType="slide" onRequestClose={fechar}>
        <ScrollView
          style={styles.tela}
          contentContainerStyle={styles.formConteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Cabecalho
            titulo={editando === 'novo' ? 'Novo motorista' : 'Editar motorista'}
            aoVoltar={fechar}
            sangrar
          />

          <Campo rotulo="Nome" value={form.nome} onChangeText={(v) => mudar('nome', v)} />
          <Campo
            rotulo="CPF"
            placeholder="Ex.: 096.668.979-89"
            value={form.cpf}
            onChangeText={(v) => mudar('cpf', mascaraCPF(v))}
            keyboardType="numeric"
            maxLength={14}
          />
          <Campo
            rotulo="CNH (número de registro, 11 números)"
            placeholder="Ex.: 01234567890"
            value={form.cnh}
            onChangeText={(v) => mudar('cnh', somenteDigitos(v).slice(0, 11))}
            keyboardType="numeric"
            maxLength={11}
          />
          <Campo
            rotulo="Celular com WhatsApp (DDD + número)"
            placeholder="Ex.: 44 98751-3965"
            value={form.telefone}
            onChangeText={(v) => mudar('telefone', mascaraTelefone(v))}
            keyboardType="phone-pad"
            maxLength={14}
          />

          <Text style={styles.rotulo}>Situação</Text>
          <View style={styles.opcoes}>
            <Opcao texto="Ativo" ativo={form.ativo} aoTocar={() => mudar('ativo', true)} />
            <Opcao texto="Inativo" ativo={!form.ativo} aoTocar={() => mudar('ativo', false)} />
          </View>

          <SeletorLista
            rotulo="Caminhão responsável"
            valor={form.caminhao_id}
            opcoes={opcoesCaminhao}
            aoMudar={(id) => mudar('caminhao_id', id)}
            placeholder="Escolher caminhão…"
            placeholderBusca="Buscar placa…"
            vazio="Nenhum caminhão disponível."
          />

          <Text style={styles.secaoAcesso}>Acesso ao app</Text>
          <Text style={styles.dica}>
            O login do motorista é o CPF. Ao salvar, a conta é criada automaticamente. Senha
            inicial = CPF (só números), ou informe outra abaixo.
          </Text>
          <View style={styles.caixaAcesso}>
            <Text style={styles.rotulo}>Identificador (CPF)</Text>
            <Text style={styles.cpfLogin}>{form.cpf || '— informe o CPF acima —'}</Text>
            <Campo
              rotulo={
                temAcesso
                  ? 'Redefinir senha (deixe em branco para manter)'
                  : 'Senha (opcional; padrão = dígitos do CPF)'
              }
              value={form.acesso_senha}
              onChangeText={(v) => mudar('acesso_senha', v)}
              secureTextEntry
              autoCapitalize="none"
            />
            {msgAcesso && (
              <Text style={msgAcesso.erro ? styles.erroForm : styles.okAcesso}>{msgAcesso.texto}</Text>
            )}
            {temAcesso && editando !== 'novo' && (
              <Pressable onPress={removerAcesso} disabled={salvando}>
                <Text style={styles.removerAcesso}>Remover acesso deste motorista</Text>
              </Pressable>
            )}
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
                {confirmando ? 'Toque de novo para confirmar a exclusão' : 'Excluir motorista'}
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
  botaoNovo: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 14 },
  busca: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  resumo: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  maisBotao: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  maisTexto: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nome: { fontSize: 17, fontWeight: '700', color: '#1f2937', flexShrink: 1, marginRight: 8 },
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
    alignItems: 'center',
  },
  opcaoAtiva: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
  erroForm: { color: '#dc2626', marginBottom: 12 },
  botao: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
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
  secaoAcesso: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 8, marginBottom: 8 },
  dica: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  caixaAcesso: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16 },
  cpfLogin: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
  },
  removerAcesso: { color: '#dc2626', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  okAcesso: { color: '#16a34a', marginBottom: 12, fontWeight: '600' },
  whats: {
    alignSelf: 'flex-start',
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  whatsTexto: { color: '#fff', fontWeight: '600', fontSize: 13 },
});