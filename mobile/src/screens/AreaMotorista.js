// =====================================================================================
// AreaMotorista.js — tela "ÁREA DO MOTORISTA" (é a única tela que o motorista vê).
//
// O que a tela faz:
//   1) Mostra o caminhão do motorista (placa, modelo, km, tanque).
//   2) Três botões: "+ Abastecimento", "+ Lavagem" e "+ Manutenção" (só com caminhão ativo).
//   3) Lista "Meus lançamentos", com o status de cada um (aguardando, aprovado, recusado).
//
// Regras de negócio:
//   - Abastecimento fica PENDENTE até o administrador aprovar (mexe no estoque do tanque).
//   - Lavagem e manutenção valem na hora (não mexem no estoque).
//   - O caminhão e o motorista vêm do login (token) no backend, nunca da tela.
//
// Conversa com a API (MeuController.php, rotas com prefixo /meu):
//   GET  /meu/painel         -> caminhão + histórico
//   GET  /meu/tanques        -> tanques para escolher no abastecimento
//   POST /meu/abastecimentos -> envia abastecimento (pendente)
//   POST /meu/lavagens       -> registra lavagem
//   POST /meu/manutencoes    -> registra manutenção
// =====================================================================================

// ---------- Importações ----------
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, // rodinha de "carregando"
  FlatList,          // lista eficiente
  Modal,             // janela por cima da tela (formulários)
  Platform,          // diz se está rodando na web, Android ou iOS
  Pressable,         // área clicável
  RefreshControl,    // "puxar para atualizar"
  ScrollView,        // área com rolagem
  StyleSheet,        // estilos
  Text,
  TextInput,         // campo de digitação
  View,              // caixa/contêiner
} from 'react-native';
// Biblioteca do Expo para escolher uma foto da galeria (foto da nota do posto).
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import Moldura from '../ui/Moldura';
// useAuth dá acesso ao login (aqui usamos só o "sair").
import { useAuth } from '../auth/AuthContext';
// mascaraMoeda("890") -> "R$ 8,90" | moedaParaNumero("R$ 8,90") -> 8.9 ("" -> NaN)
import { mascaraMoeda, moedaParaNumero } from '../utils/formatos';
import { cores } from '../ui/tema';

// ---------- Funções de formatação ----------
// 15000 -> "15.000"
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));

// A tela mostra a data como dd/mm/aaaa; a API recebe aaaa-mm-dd.
const hoje = () => {
  const d = new Date();
  // padStart(2, '0'): 5 -> "05". getMonth() começa em 0 (janeiro), por isso o +1.
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
// Ontem, no mesmo formato dd/mm/aaaa (usado no abastecimento fora da base).
const ontem = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1); // volta um dia (o JavaScript ajusta mês e ano sozinho)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
// "16/11/2026" -> "2026-11-16" (ou null, se o texto não estiver no formato).
const paraISO = (texto) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
// "35,5" -> 35.5 (aceita vírgula, que é como o brasileiro digita).
const decimal = (texto) => Number(String(texto).replace(',', '.'));

// Mensagem amigável: servidor desligado ou a mensagem que o backend mandou.
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

// ---------- Peças visuais ----------
// Campo de texto com rótulo em cima ("...props" repassa value, onChangeText etc.).
function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
    </View>
  );
}

// Botão de escolha (tanque, tipo de manutenção, foto...). "ativo" = escolhido.
function Opcao({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.opcao, ativo && styles.opcaoAtiva]}>
      <Text style={[styles.opcaoTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

// Texto e cor de cada status de lançamento.
const STATUS = {
  pendente: { texto: 'Aguardando aprovação', cor: cores.primaria },
  aprovado: { texto: 'Aprovado', cor: cores.texto },
  recusado: { texto: 'Recusado', cor: cores.perigo },
};

// Etiqueta colorida com o status. `${s.cor}22` = mesma cor, bem clarinha (transparente).
function EtiquetaStatus({ status }) {
  const s = STATUS[status] ?? STATUS.pendente;
  return (
    <View style={[styles.etiqueta, { backgroundColor: `${s.cor}22` }]}>
      <Text style={[styles.etiquetaTexto, { color: s.cor }]}>{s.texto}</Text>
    </View>
  );
}

// Moldura comum dos três formulários (abastecimento, lavagem, manutenção).
// Assim o cabeçalho, a mensagem de erro e os botões Registrar/Cancelar são escritos uma vez só.
// "children" = os campos que cada formulário coloca dentro dele.
// "aprovacao = false" = valor padrão (só o abastecimento passa aprovacao = true).
function Formulario({ titulo, visivel, aoFechar, aoEnviar, enviando, erro, aprovacao = false, children }) {
  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar}>
      <Moldura>
      <ScrollView style={styles.modal} contentContainerStyle={styles.formConteudo} keyboardShouldPersistTaps="handled">
        <Cabecalho titulo={titulo} aoVoltar={aoFechar} />
        {aprovacao && (
          <Text style={styles.aviso}>O abastecimento só vale depois que o administrador aprovar.</Text>
        )}
        {children}
        {erro && <Text style={styles.erroForm}>{erro}</Text>}
        <Pressable style={[styles.botao, enviando && styles.desativado]} onPress={aoEnviar} disabled={enviando}>
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botaoTexto}>{aprovacao ? 'Enviar para aprovação' : 'Registrar'}</Text>
          )}
        </Pressable>
        <Pressable style={styles.botaoSecundario} onPress={aoFechar} disabled={enviando}>
          <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
        </Pressable>
      </ScrollView>
      </Moldura>
    </Modal>
  );
}

// ---------- Abastecimento ----------
// Duas origens: "base" (sai de um tanque da empresa) ou "externo" (posto, com valor, nota e foto).
function FormAbastecimento({ caminhao, aoFechar, aoEnviado }) {
  const [origem, setOrigem] = useState('base');
  const [tanques, setTanques] = useState([]);
  const [f, setF] = useState({
    tanque_id: null,
    data: hoje(),
    litros: '',
    km: String(caminhao.km_atual), // já vem com o km atual do caminhão
    posto: '',
    valor_total: '',
    nota_numero: '',
  });
  const [foto, setFoto] = useState(null);
  // Dia do abastecimento fora da base: 'hoje' ou 'ontem'. Na base é sempre hoje.
  const [dia, setDia] = useState('hoje');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  // Ao abrir o formulário, busca os tanques (o [] no fim = roda uma vez só).
  useEffect(() => {
    api('/meu/tanques').then(setTanques).catch(() => {});
  }, []);

  const mudar = (campo, valor) => setF((atual) => ({ ...atual, [campo]: valor }));

  // Abre a galeria. quality: 0.6 = comprime a imagem (arquivo menor para enviar).
  const escolherFoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!r.canceled) setFoto(r.assets[0]);
  };

  const enviar = async () => {
    const litros = decimal(f.litros);
    const km = Number(f.km);
    const valor = moedaParaNumero(f.valor_total);
    // Data: na base, sempre hoje; fora da base, hoje ou ontem (o que foi escolhido nos botões).
    // O backend confere a mesma regra de novo.
    const data = paraISO(origem === 'externo' && dia === 'ontem' ? ontem() : hoje());

    // Conferências antes de enviar (o servidor confere de novo).
    // "!(litros > 0)" também pega NaN (texto inválido), que não é maior que zero.
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
      // (JSON não carrega arquivo; FormData é o mesmo formato de um formulário HTML com upload.)
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
          // Na web a foto precisa virar um "blob" (o arquivo em si);
          // no celular basta passar o endereço (uri), o nome e o tipo.
          if (Platform.OS === 'web') {
            corpo.append('foto', await (await fetch(foto.uri)).blob(), nome);
          } else {
            corpo.append('foto', { uri: foto.uri, name: nome, type: foto.mimeType ?? 'image/jpeg' });
          }
        }
      }
      const r = await api('/meu/abastecimentos', { metodo: 'POST', corpo });
      aoEnviado(r.message); // avisa a tela principal (fecha o formulário e mostra a mensagem)
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Formulario titulo="Novo abastecimento" aprovacao visivel aoFechar={aoFechar} aoEnviar={enviar} enviando={enviando} erro={erro}>
      <Text style={styles.rotulo}>Onde abasteceu?</Text>
      <View style={styles.opcoes}>
        <Opcao texto="Na base" ativo={origem === 'base'} aoTocar={() => setOrigem('base')} />
        <Opcao texto="Fora da base (posto)" ativo={origem === 'externo'} aoTocar={() => setOrigem('externo')} />
      </View>

      {/* Na base: escolhe o tanque de onde saiu o combustível */}
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
      {/* Data: na base é sempre hoje (só mostra); fora da base, escolhe hoje ou ontem */}
      <Text style={styles.rotulo}>Data do abastecimento</Text>
      {origem === 'base' ? (
        <Text style={styles.aviso}>Hoje, {hoje()} (abastecimento na base é lançado no mesmo dia)</Text>
      ) : (
        <View style={styles.opcoes}>
          <Opcao texto={`Hoje (${hoje()})`} ativo={dia === 'hoje'} aoTocar={() => setDia('hoje')} />
          <Opcao texto={`Ontem (${ontem()})`} ativo={dia === 'ontem'} aoTocar={() => setDia('ontem')} />
        </View>
      )}

      {/* Fora da base: posto, valor, número da nota e foto (opcional) */}
      {origem === 'externo' && (
        <>
          <Campo rotulo="Nome do posto" value={f.posto} onChangeText={(v) => mudar('posto', v)} />
          <Campo
            rotulo="Valor total pago"
            placeholder="R$ 0,00"
            value={f.valor_total}
            onChangeText={(v) => mudar('valor_total', mascaraMoeda(v))}
            keyboardType="numeric"
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
// Feita na própria empresa: sem custo, só a data em que o caminhão foi lavado.
function FormLavagem({ aoFechar, aoEnviado }) {
  const [data, setData] = useState(hoje());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  const enviar = async () => {
    const iso = paraISO(data);
    if (!iso) return setErro('Informe a data no formato dd/mm/aaaa.');

    setEnviando(true);
    setErro(null);
    try {
      const r = await api('/meu/lavagens', { metodo: 'POST', corpo: { data: iso } });
      aoEnviado(r.message);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Formulario titulo="Nova lavagem" visivel aoFechar={aoFechar} aoEnviar={enviar} enviando={enviando} erro={erro}>
      <Campo rotulo="Data da lavagem (dd/mm/aaaa)" value={data} onChangeText={setData} maxLength={10} />
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
    // Campo de valor vazio = manutenção sem custo (R$ 0,00).
    // (A máscara de dinheiro apaga o zero digitado, por isso o vazio vale como zero.)
    const valor = f.valor === '' ? 0 : moedaParaNumero(f.valor);
    const km = Number(f.km);
    const data = paraISO(f.data);
    if (!f.tipo.trim()) return setErro('Informe o tipo de manutenção.');
    if (!data) return setErro('Informe a data no formato dd/mm/aaaa.');
    if (Number.isNaN(valor) || valor < 0) return setErro('Informe um valor válido.');
    if (f.km === '' || Number.isNaN(km)) return setErro('Informe a quilometragem.');

    setEnviando(true);
    setErro(null);
    try {
      const r = await api('/meu/manutencoes', {
        metodo: 'POST',
        corpo: { data, tipo: f.tipo.trim(), descricao: f.descricao.trim() || null, valor, km },
      });
      aoEnviado(r.message);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Formulario titulo="Nova manutenção" visivel aoFechar={aoFechar} aoEnviar={enviar} enviando={enviando} erro={erro}>
      <Campo rotulo="Tipo de manutenção" value={f.tipo} onChangeText={(v) => mudar('tipo', v)} />
      {/* Atalhos: tocar preenche o campo "Tipo" */}
      <View style={styles.opcoes}>
        {TIPOS_MANUTENCAO.map((t) => (
          <Opcao key={t} texto={t} ativo={f.tipo === t} aoTocar={() => mudar('tipo', t)} />
        ))}
      </View>
      <Campo rotulo="Descrição (opcional)" value={f.descricao} onChangeText={(v) => mudar('descricao', v)} multiline />
      <Campo
        rotulo="Valor (deixe vazio se não teve custo)"
        placeholder="R$ 0,00"
        value={f.valor}
        onChangeText={(v) => mudar('valor', mascaraMoeda(v))}
        keyboardType="numeric"
      />
      <Campo rotulo="Quilometragem do caminhão" value={f.km} onChangeText={(v) => mudar('km', v)} keyboardType="numeric" />
      <Campo rotulo="Data (dd/mm/aaaa)" value={f.data} onChangeText={(v) => mudar('data', v)} maxLength={10} />
    </Formulario>
  );
}

// ---------- Tela principal do motorista ----------
export default function AreaMotorista() {
  const { sair } = useAuth();
  const [dados, setDados] = useState(null);           // resposta de /meu/painel
  const [erro, setErro] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [formAberto, setFormAberto] = useState(null); // 'abastecimento' | 'lavagem' | 'manutencao' | null
  const [aviso, setAviso] = useState(null);           // mensagem de sucesso depois de enviar

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

  // Carrega uma vez ao abrir a tela.
  useEffect(() => {
    carregar();
  }, [carregar]);

  // Chamado pelos formulários depois de enviar com sucesso.
  const aoEnviado = (mensagem) => {
    setFormAberto(null);
    setAviso(mensagem);
    carregar(); // atualiza o histórico e o km
  };

  // "?." = se dados ainda for null, não dá erro (caminhao fica undefined).
  const caminhao = dados?.caminhao;
  // Só pode lançar com caminhão vinculado E ativo.
  const pronto = caminhao && caminhao.status === 'ativo';

  // Parte de cima da lista: dados do caminhão, botões e título "Meus lançamentos".
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

      {/* Os três botões de lançamento: cada um abre o formulário correspondente */}
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
      <Cabecalho titulo="ÁREA DO MOTORISTA">
        <Pressable onPress={sair} hitSlop={8}>
          <Text style={styles.sair}>Sair</Text>
        </Pressable>
      </Cabecalho>
      {/* split(' ')[0] = só o primeiro nome ("Wallace Gabriel" -> "Wallace") */}
      <Text style={styles.titulo}>Olá, {dados?.motorista?.nome?.split(' ')[0] ?? ''}</Text>

      {erro && <Text style={styles.erroTela}>{erro}</Text>}
      {!dados && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      {dados && (
        <FlatList
          data={dados.historico}
          // A chave junta tipo + id, porque um abastecimento e uma lavagem podem ter o mesmo id.
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
          // Cada lançamento: título, data, linhas de detalhe (vêm prontas do backend) e status.
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

      {/* Só um formulário aberto por vez, conforme "formAberto" */}
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

// ---------- Estilos ----------
const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 16, paddingTop: 56 },
  topo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: cores.texto },
  sair: { fontSize: 15, fontWeight: '700', color: '#fff' },
  erroTela: { color: cores.perigo, marginTop: 20, textAlign: 'center' },
  // Cartão do caminhão
  caixaCaminhao: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  placa: { fontSize: 26, fontWeight: 'bold', color: cores.texto },
  detalhe: { fontSize: 13, color: cores.textoSecundario, marginTop: 3 },
  // Os três botões vermelhos (+ Abastecimento / + Lavagem / + Manutenção)
  acoes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  acao: { flex: 1, backgroundColor: cores.primaria, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  acaoTexto: { color: '#fff', fontWeight: '600', fontSize: 14 },
  sucesso: { color: cores.texto, fontWeight: '600', marginBottom: 8 },
  secao: { fontSize: 18, fontWeight: '600', color: cores.texto, marginBottom: 8, marginTop: 4 },
  vazio: { textAlign: 'center', color: cores.textoSecundario, marginTop: 30 },
  // Cartão de cada lançamento
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between' },
  itemTitulo: { fontSize: 16, fontWeight: 'bold', color: cores.texto, flexShrink: 1 },
  etiqueta: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  etiquetaTexto: { fontSize: 12, fontWeight: '600' },
  motivo: { fontSize: 13, color: cores.perigo, marginTop: 6 },

  // ----- Formulários -----
  modal: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 16, paddingTop: 56 },
  formConteudo: { paddingBottom: 40, width: '100%', maxWidth: 520, alignSelf: 'center' },
  aviso: { fontSize: 13, color: cores.textoSecundario, marginBottom: 12 },
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
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  opcao: {
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  opcaoAtiva: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: cores.textoMedio },
  erroForm: { color: cores.perigo, marginBottom: 12, marginTop: 6 },
  botao: { backgroundColor: cores.primaria, borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: cores.textoMedio, fontSize: 16, fontWeight: '600' },
});