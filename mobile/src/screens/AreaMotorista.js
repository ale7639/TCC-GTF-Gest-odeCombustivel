import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';

// ---------- Funções de formatação ----------
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));

// A tela mostra a data como dd/mm/aaaa; a API recebe aaaa-mm-dd.
const hoje = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
const paraISO = (texto) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const decimal = (texto) => Number(String(texto).replace(',', '.'));

const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

// ---------- Peças visuais ----------
function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
    </View>
  );
}

function Opcao({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.opcao, ativo && styles.opcaoAtiva]}>
      <Text style={[styles.opcaoTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

const STATUS = {
  pendente: { texto: 'Aguardando aprovação', cor: '#b45309' },
  aprovado: { texto: 'Aprovado', cor: '#16a34a' },
  recusado: { texto: 'Recusado', cor: '#dc2626' },
};

function EtiquetaStatus({ status }) {
  const s = STATUS[status] ?? STATUS.pendente;
  return (
    <View style={[styles.etiqueta, { backgroundColor: `${s.cor}22` }]}>
      <Text style={[styles.etiquetaTexto, { color: s.cor }]}>{s.texto}</Text>
    </View>
  );
}

// Moldura comum dos três formulários (abastecimento, lavagem, manutenção).
function Formulario({ titulo, visivel, aoFechar, aoEnviar, enviando, erro, children }) {
  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar}>
      <ScrollView style={styles.modal} contentContainerStyle={styles.formConteudo} keyboardShouldPersistTaps="handled">
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.aviso}>O lançamento só vale depois que o administrador aprovar.</Text>
        {children}
        {erro && <Text style={styles.erroForm}>{erro}</Text>}
        <Pressable style={[styles.botao, enviando && styles.desativado]} onPress={aoEnviar} disabled={enviando}>
          {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>Enviar para aprovação</Text>}
        </Pressable>
        <Pressable style={styles.botaoSecundario} onPress={aoFechar} disabled={enviando}>
          <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

// ---------- Abastecimento ----------
function FormAbastecimento({ caminhao, aoFechar, aoEnviado }) {
  const [origem, setOrigem] = useState('base');
  const [tanques, setTanques] = useState([]);
  const [f, setF] = useState({
    tanque_id: null,
    data: hoje(),
    litros: '',
    km: String(caminhao.km_atual),
    posto: '',
    valor_total: '',
    nota_numero: '',
  });
  const [foto, setFoto] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    api('/meu/tanques').then(setTanques).catch(() => {});
  }, []);

  const mudar = (campo, valor) => setF((atual) => ({ ...atual, [campo]: valor }));

  const escolherFoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!r.canceled) setFoto(r.assets[0]);
  };

  const enviar = async () => {
    const litros = decimal(f.litros);
    const km = Number(f.km);
    const valor = decimal(f.valor_total);
    const data = paraISO(f.data);

    if (origem === 'base' && !f.tanque_id) return setErro('Escolha o tanque.');
    if (!(litros > 0)) return setErro('Informe a quantidade de litros.');
    if (f.km === '' || Number.isNaN(km)) return setErro('Informe a quilometragem.');
    if (!data) return setErro('Informe a data no formato dd/mm/aaaa.');
    if (origem === 'externo') {
      if (!f.posto.trim()) return setErro('Informe o nome do posto.');
      if (!(valor > 0)) return setErro('Informe o valor total pago.');
    }

    setEnviando(true);
    setErro(null);
    try {
      // FormData permite enviar a foto junto com os campos.
      const corpo = new FormData();
      corpo.append('origem', origem);
      corpo.append('data', data);
      corpo.append('litros', String(litros));
      corpo.append('km', String(km));
      if (origem === 'base') {
        corpo.append('tanque_id', String(f.tanque_id));
      } else {
        corpo.append('posto', f.posto.trim());
        corpo.append('valor_total', String(valor));
        if (f.nota_numero.trim()) corpo.append('nota_numero', f.nota_numero.trim());
        if (foto) {
          const nome = foto.fileName ?? 'foto.jpg';
          if (Platform.OS === 'web') {
            corpo.append('foto', await (await fetch(foto.uri)).blob(), nome);
          } else {
            corpo.append('foto', { uri: foto.uri, name: nome, type: foto.mimeType ?? 'image/jpeg' });
          }
        }
      }
      await api('/meu/abastecimentos', { metodo: 'POST', corpo });
      aoEnviado();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Formulario titulo="Novo abastecimento" visivel aoFechar={aoFechar} aoEnviar={enviar} enviando={enviando} erro={erro}>
      <Text style={styles.rotulo}>Onde abasteceu?</Text>
      <View style={styles.opcoes}>
        <Opcao texto="Na base" ativo={origem === 'base'} aoTocar={() => setOrigem('base')} />
        <Opcao texto="Fora da base (posto)" ativo={origem === 'externo'} aoTocar={() => setOrigem('externo')} />
      </View>

      {origem === 'base' && (
        <>
          <Text style={styles.rotulo}>Tanque de origem</Text>
          <View style={styles.opcoes}>
            {tanques.map((t) => (
              <Opcao
                key={t.id}
                texto={`${t.nome} · ${t.tipo_combustivel}`}
                ativo={f.tanque_id === t.id}
                aoTocar={() => mudar('tanque_id', t.id)}
              />
            ))}
          </View>
        </>
      )}

      <Campo rotulo="Litros" value={f.litros} onChangeText={(v) => mudar('litros', v)} keyboardType="decimal-pad" />
      <Campo rotulo="Quilometragem do caminhão" value={f.km} onChangeText={(v) => mudar('km', v)} keyboardType="numeric" />
      <Campo rotulo="Data (dd/mm/aaaa)" value={f.data} onChangeText={(v) => mudar('data', v)} maxLength={10} />

      {origem === 'externo' && (
        <>
          <Campo rotulo="Nome do posto" value={f.posto} onChangeText={(v) => mudar('posto', v)} />
          <Campo
            rotulo="Valor total pago (R$)"
            value={f.valor_total}
            onChangeText={(v) => mudar('valor_total', v)}
            keyboardType="decimal-pad"
          />
          <Campo
            rotulo="Número da nota fiscal (opcional)"
            value={f.nota_numero}
            onChangeText={(v) => mudar('nota_numero', v)}
            maxLength={30}
          />
          <Text style={styles.rotulo}>Foto da nota (opcional)</Text>
          <View style={styles.opcoes}>
            <Opcao texto={foto ? 'Trocar foto' : 'Escolher foto'} ativo={false} aoTocar={escolherFoto} />
            {foto && <Opcao texto="Remover foto" ativo={false} aoTocar={() => setFoto(null)} />}
          </View>
          {foto && <Text style={styles.aviso}>Foto selecionada: {foto.fileName ?? 'imagem'}</Text>}
        </>
      )}
    </Formulario>
  );
}

// ---------- Lavagem ----------
function FormLavagem({ aoFechar, aoEnviado }) {
  const [f, setF] = useState({ data: hoje(), valor: '', observacao: '' });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const mudar = (campo, valor) => setF((atual) => ({ ...atual, [campo]: valor }));

  const enviar = async () => {
    const valor = decimal(f.valor);
    const data = paraISO(f.data);
    if (!data) return setErro('Informe a data no formato dd/mm/aaaa.');
    if (f.valor === '' || Number.isNaN(valor) || valor < 0) return setErro('Informe o valor da lavagem.');

    setEnviando(true);
    setErro(null);
    try {
      await api('/meu/lavagens', {
        metodo: 'POST',
        corpo: { data, valor, observacao: f.observacao.trim() || null },
      });
      aoEnviado();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Formulario titulo="Nova lavagem" visivel aoFechar={aoFechar} aoEnviar={enviar} enviando={enviando} erro={erro}>
      <Campo rotulo="Data (dd/mm/aaaa)" value={f.data} onChangeText={(v) => mudar('data', v)} maxLength={10} />
      <Campo rotulo="Valor (R$)" value={f.valor} onChangeText={(v) => mudar('valor', v)} keyboardType="decimal-pad" />
      <Campo rotulo="Observação (opcional)" value={f.observacao} onChangeText={(v) => mudar('observacao', v)} />
    </Formulario>
  );
}

// ---------- Manutenção ----------
const TIPOS_MANUTENCAO = ['Troca de óleo', 'Pneus', 'Freios', 'Revisão'];

function FormManutencao({ caminhao, aoFechar, aoEnviado }) {
  const [f, setF] = useState({
    data: hoje(),
    tipo: '',
    descricao: '',
    valor: '',
    km: String(caminhao.km_atual),
  });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const mudar = (campo, valor) => setF((atual) => ({ ...atual, [campo]: valor }));

  const enviar = async () => {
    const valor = decimal(f.valor);
    const km = Number(f.km);
    const data = paraISO(f.data);
    if (!f.tipo.trim()) return setErro('Informe o tipo de manutenção.');
    if (!data) return setErro('Informe a data no formato dd/mm/aaaa.');
    if (f.valor === '' || Number.isNaN(valor) || valor < 0) return setErro('Informe o valor.');
    if (f.km === '' || Number.isNaN(km)) return setErro('Informe a quilometragem.');

    setEnviando(true);
    setErro(null);
    try {
      await api('/meu/manutencoes', {
        metodo: 'POST',
        corpo: { data, tipo: f.tipo.trim(), descricao: f.descricao.trim() || null, valor, km },
      });
      aoEnviado();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Formulario titulo="Nova manutenção" visivel aoFechar={aoFechar} aoEnviar={enviar} enviando={enviando} erro={erro}>
      <Campo rotulo="Tipo de manutenção" value={f.tipo} onChangeText={(v) => mudar('tipo', v)} />
      <View style={styles.opcoes}>
        {TIPOS_MANUTENCAO.map((t) => (
          <Opcao key={t} texto={t} ativo={f.tipo === t} aoTocar={() => mudar('tipo', t)} />
        ))}
      </View>
      <Campo rotulo="Descrição (opcional)" value={f.descricao} onChangeText={(v) => mudar('descricao', v)} multiline />
      <Campo rotulo="Valor (R$)" value={f.valor} onChangeText={(v) => mudar('valor', v)} keyboardType="decimal-pad" />
      <Campo rotulo="Quilometragem do caminhão" value={f.km} onChangeText={(v) => mudar('km', v)} keyboardType="numeric" />
      <Campo rotulo="Data (dd/mm/aaaa)" value={f.data} onChangeText={(v) => mudar('data', v)} maxLength={10} />
    </Formulario>
  );
}

// ---------- Tela principal do motorista ----------
export default function AreaMotorista() {
  const { sair } = useAuth();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [formAberto, setFormAberto] = useState(null); // 'abastecimento' | 'lavagem' | 'manutencao' | null
  const [aviso, setAviso] = useState(null);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setDados(await api('/meu/painel'));
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const aoEnviado = () => {
    setFormAberto(null);
    setAviso('Enviado! Aguardando aprovação do administrador.');
    carregar();
  };

  const caminhao = dados?.caminhao;
  const pronto = caminhao && caminhao.status === 'ativo';

  const cabecalho = dados && (
    <View>
      <View style={styles.caixaCaminhao}>
        {caminhao ? (
          <>
            <Text style={styles.placa}>{caminhao.placa}</Text>
            <Text style={styles.detalhe}>{caminhao.modelo}</Text>
            <Text style={styles.detalhe}>
              {numero(caminhao.km_atual)} km · tanque de {numero(caminhao.capacidade_tanque)} L
            </Text>
            {!pronto && <Text style={styles.erroForm}>Seu caminhão não está ativo no momento.</Text>}
          </>
        ) : (
          <Text style={styles.aviso}>Você ainda não tem um caminhão vinculado. Fale com o administrador.</Text>
        )}
      </View>

      {pronto && (
        <View style={styles.acoes}>
          {[
            ['abastecimento', 'Abastecimento'],
            ['lavagem', 'Lavagem'],
            ['manutencao', 'Manutenção'],
          ].map(([chave, rotulo]) => (
            <Pressable
              key={chave}
              style={styles.acao}
              onPress={() => {
                setAviso(null);
                setFormAberto(chave);
              }}
            >
              <Text style={styles.acaoTexto}>+ {rotulo}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {aviso && <Text style={styles.sucesso}>{aviso}</Text>}
      <Text style={styles.secao}>Meus lançamentos</Text>
    </View>
  );

  return (
    <View style={styles.tela}>
      <View style={styles.topo}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Olá, {dados?.motorista?.nome?.split(' ')[0] ?? ''}</Text>
          <Text style={styles.detalhe}>Área do motorista</Text>
        </View>
        <Pressable onPress={sair}>
          <Text style={styles.sair}>Sair</Text>
        </Pressable>
      </View>

      {erro && <Text style={styles.erroTela}>{erro}</Text>}
      {!dados && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      {dados && (
        <FlatList
          data={dados.historico}
          keyExtractor={(item) => `${item.tipo}-${item.id}`}
          ListHeaderComponent={cabecalho}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={() => {
                setAtualizando(true);
                carregar();
              }}
            />
          }
          ListEmptyComponent={<Text style={styles.vazio}>Você ainda não fez nenhum lançamento.</Text>}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <View style={styles.caixa}>
              <View style={styles.linhaTopo}>
                <Text style={styles.itemTitulo}>{item.titulo}</Text>
              </View>
              <Text style={styles.detalhe}>{item.data_br}</Text>
              {item.linhas.map((l, i) => (
                <Text key={i} style={styles.detalhe}>
                  {l}
                </Text>
              ))}
              <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                <EtiquetaStatus status={item.status} />
              </View>
              {item.status === 'recusado' && item.motivo_recusa && (
                <Text style={styles.motivo}>Motivo: {item.motivo_recusa}</Text>
              )}
            </View>
          )}
        />
      )}

      {formAberto === 'abastecimento' && (
        <FormAbastecimento caminhao={caminhao} aoFechar={() => setFormAberto(null)} aoEnviado={aoEnviado} />
      )}
      {formAberto === 'lavagem' && <FormLavagem aoFechar={() => setFormAberto(null)} aoEnviado={aoEnviado} />}
      {formAberto === 'manutencao' && (
        <FormManutencao caminhao={caminhao} aoFechar={() => setFormAberto(null)} aoEnviado={aoEnviado} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingTop: 56 },
  topo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  sair: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
  erroTela: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  caixaCaminhao: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  placa: { fontSize: 26, fontWeight: 'bold', color: '#111827' },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 3 },
  acoes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  acao: { flex: 1, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  acaoTexto: { color: '#fff', fontWeight: '600', fontSize: 14 },
  sucesso: { color: '#16a34a', fontWeight: '600', marginBottom: 8 },
  secao: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 8, marginTop: 4 },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 30 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between' },
  itemTitulo: { fontSize: 16, fontWeight: 'bold', color: '#111827', flexShrink: 1 },
  etiqueta: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  etiquetaTexto: { fontSize: 12, fontWeight: '600' },
  motivo: { fontSize: 13, color: '#dc2626', marginTop: 6 },

  modal: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingTop: 56 },
  formConteudo: { paddingBottom: 40, width: '100%', maxWidth: 520, alignSelf: 'center' },
  aviso: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
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
  erroForm: { color: '#dc2626', marginBottom: 12, marginTop: 6 },
  botao: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: '#374151', fontSize: 16, fontWeight: '600' },
});