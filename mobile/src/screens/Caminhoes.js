// =====================================================================================
// Caminhoes.js — tela "GESTÃO DE FROTA" (só o ADMIN acessa).
//
// O que a tela faz:
//   1) Lista os caminhões, com cartões de resumo (Total / Ativos / Manutenção / Inativos)
//      que também servem de filtro, e um campo de busca (placa, modelo ou motorista).
//   2) Botão "+ Novo" abre o formulário para cadastrar.
//   3) Tocar em um caminhão abre o mesmo formulário para alterar ou excluir.
//
// Conversa com a API (backend/app/Http/Controllers/CaminhaoController.php):
//   GET    /caminhoes        -> lista          POST /caminhoes      -> cadastra
//   PUT    /caminhoes/{id}   -> altera         DELETE /caminhoes/{id} -> exclui
//   GET    /motoristas       -> lista de motoristas (para escolher o responsável)
//
// Validação em DUAS camadas:
//   - aqui na tela: limpa o que é digitado e confere antes de enviar (resposta rápida);
//   - no servidor: confere tudo de novo (é a que vale, porque alguém pode chamar a API
//     sem passar pela tela, por exemplo pelo Postman).
// =====================================================================================

// ---------- Importações ----------
// Hooks do React (funções que dão "memória" e comportamento ao componente):
//   useState    -> guarda um valor que, quando muda, redesenha a tela;
//   useCallback -> guarda uma função para não recriá-la a cada redesenho;
//   useMemo     -> guarda o RESULTADO de um cálculo e só refaz quando os dados mudam.
import { useCallback, useMemo, useState } from 'react';
// Componentes visuais do React Native (no navegador viram elementos HTML):
import {
  ActivityIndicator, // rodinha de "carregando"
  FlatList,          // lista eficiente (desenha só o que aparece na tela)
  Modal,             // janela por cima da tela (usada para o formulário)
  Pressable,         // qualquer área que pode ser tocada/clicada (botões, cartões)
  RefreshControl,    // "puxar para baixo para atualizar"
  ScrollView,        // área com rolagem
  StyleSheet,        // cria os estilos (parecido com CSS)
  Text,              // texto
  TextInput,         // campo de digitação
  View,              // caixa/contêiner (parecido com uma <div>)
} from 'react-native';
// Executa algo toda vez que esta tela fica visível (o usuário entra nela pelo menu).
import { useFocusEffect } from '@react-navigation/native';
// Nossa função que chama o backend (já envia o token de login e trata os erros).
import { api } from '../api';
// Faixa vermelha do topo com o título (e, no formulário, o botão de voltar).
import Cabecalho from '../components/Cabecalho';
// "Moldura de celular": deixa o conteúdo do Modal com a largura de um telefone no navegador.
import Moldura from '../ui/Moldura';
// Cores do sistema, todas num lugar só (src/ui/tema.js).
import { cores } from '../ui/tema';

// ---------- Funções auxiliares (ficam fora do componente: não dependem do estado) ----------

// Letras aceitas no modelo (inclui acentos: á, ç, ê...).
// "A-Za-z" = letras sem acento; "À-ÖØ-öø-ÿ" = faixas da tabela Unicode com as letras acentuadas
// (os símbolos × e ÷, que ficam no meio dessa faixa, ficam de fora).
const LETRAS = 'A-Za-zÀ-ÖØ-öø-ÿ';
// Tira do modelo o que não for letra, número, espaço, hífen, ponto ou barra.
// new RegExp(...) monta a expressão regular a partir de um texto (para reaproveitar LETRAS).
// [^...] = "qualquer caractere que NÃO esteja na lista"; 'g' = troca todos, não só o primeiro.
// Resultado: se o usuário digitar "Volvo@FH#", o campo fica "VolvoFH" na hora.
const limparModelo = (v) => v.replace(new RegExp(`[^${LETRAS}0-9 ./-]`, 'g'), '');
// Quantas letras o texto tem (o modelo precisa de pelo menos 2).
// match(...) devolve a lista das letras encontradas, ou null se não achar nenhuma;
// "|| []" troca o null por lista vazia, para o .length dar 0 em vez de erro.
const contarLetras = (v) => (v.match(new RegExp(`[${LETRAS}]`, 'g')) || []).length;
// Deixa só os números (para ano, capacidade e quilometragem).
// \D = "qualquer coisa que não seja dígito" -> é trocada por nada.
const soNumeros = (v) => v.replace(/\D/g, '');
// Ano máximo aceito = ano atual + 1 (caminhão "modelo do ano que vem"). Mesma regra do backend.
const ANO_MAXIMO = new Date().getFullYear() + 1;

// 15000 -> "15.000"
// Math.round arredonda; a expressão regular coloca um ponto a cada 3 dígitos, da direita para a esquerda.
const numero = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Mensagem amigável para qualquer erro de comunicação com a API.
// Se o servidor estiver desligado (rede falhou ou demorou demais), mostra um texto claro;
// senão, mostra a mensagem que o próprio backend mandou (ex.: "Já existe um caminhão com esta placa.").
// "condição ? valorSeSim : valorSeNao" = operador ternário (um if/else em uma linha).
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

// Os três status possíveis, com o texto e a cor de cada um.
// "valor" é o que vai para o banco; "rotulo" é o que aparece na tela.
const STATUS = [
  { valor: 'ativo', rotulo: 'Ativo', cor: cores.ativo },               // verde
  { valor: 'manutencao', rotulo: 'Manutenção', cor: cores.primaria },  // vermelho
  { valor: 'inativo', rotulo: 'Inativo', cor: cores.textoSecundario }, // cinza
];
// Procura o status pelo valor. "??" = se não encontrar (undefined), usa o "Inativo" (STATUS[2]).
const infoStatus = (valor) => STATUS.find((s) => s.valor === valor) ?? STATUS[2];

// Formulário em branco para um caminhão novo.
// É uma FUNÇÃO (e não um objeto fixo) para gerar um objeto novo cada vez que é chamada.
// Os números ficam como TEXTO, porque o TextInput só trabalha com texto;
// eles viram número só na hora de enviar (veja "corpo" dentro de salvar).
const formVazio = () => ({
  placa: '',
  modelo: '',
  ano: String(new Date().getFullYear()), // já vem com o ano atual
  capacidade_tanque: '',
  km_atual: '0',
  status: 'ativo',
  motorista_id: null, // null = sem motorista
});

// ---------- Componentes pequenos usados só nesta tela ----------
// Componente = função que recebe "props" (parâmetros) e devolve o que desenhar (JSX).

// Etiqueta colorida com o status.
function Etiqueta({ status }) {
  // Desestruturação: pega "rotulo" e "cor" de dentro do objeto devolvido por infoStatus.
  const { rotulo, cor } = infoStatus(status);
  return (
    // `${cor}22` = a mesma cor com transparência (o "22" no fim do código hex é a opacidade, ~13%).
    // Assim o fundo fica clarinho e o texto na cor forte.
    <View style={[styles.etiqueta, { backgroundColor: `${cor}22` }]}>
      <Text style={[styles.etiquetaTexto, { color: cor }]}>{rotulo}</Text>
    </View>
  );
}

// Campo de texto com rótulo em cima.
// "...props" (rest) = junta todas as outras propriedades recebidas (value, onChangeText,
// placeholder, maxLength...) e "{...props}" (spread) repassa todas elas para o TextInput.
// Assim o mesmo componente serve para todos os campos do formulário.
function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
    </View>
  );
}

// Botão de escolha (usado para selecionar o motorista).
// "ativo" = se é a opção escolhida (fica vermelha); "aoTocar" = função chamada no clique.
function Opcao({ texto, ativo, aoTocar }) {
  return (
    // "ativo && estilo" = só aplica o estilo quando ativo for verdadeiro.
    <Pressable onPress={aoTocar} style={[styles.opcaoSimples, ativo && styles.opcaoSimplesAtiva]}>
      <Text style={[styles.opcaoSimplesTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

// ---------- A tela em si ----------
// "export default" = é isto que o App.js importa quando faz "import Caminhoes from ...".
export default function Caminhoes() {
  // useState devolve [valor, funçãoQueMudaOValor]. O valor entre parênteses é o inicial.
  const [caminhoes, setCaminhoes] = useState([]);
  const [motoristas, setMotoristas] = useState([]); // usados para escolher o motorista do caminhão
  const [carregando, setCarregando] = useState(true);    // primeira carga (mostra a rodinha)
  const [atualizando, setAtualizando] = useState(false); // "puxar para atualizar"
  const [erro, setErro] = useState(null);                // erro ao carregar a lista
  const [busca, setBusca] = useState('');                // texto digitado na busca
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos' | 'ativo' | 'manutencao' | 'inativo'

  // editando: null = formulário fechado | 'novo' = cadastrando | objeto = alterando aquele caminhão
  // (uma variável só controla três situações; o Modal abre sempre que ela não for null).
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());  // valores dos campos do formulário
  const [salvando, setSalvando] = useState(false); // true enquanto espera a API (trava os botões)
  const [erroForm, setErroForm] = useState(null);  // mensagem de erro mostrada no formulário
  const [confirmando, setConfirmando] = useState(false); // pede um segundo toque para excluir

  // Busca os dados no backend.
  // async/await = espera a resposta da API sem travar a tela.
  // useCallback(..., []) = a função é criada uma vez só (a lista [] vazia = não depende de nada).
  const carregar = useCallback(async () => {
    try {
      setErro(null);
      // As duas listas são buscadas ao mesmo tempo.
      // Promise.all espera as DUAS terminarem (mais rápido que uma depois da outra)
      // e devolve os resultados na mesma ordem: [caminhões, motoristas].
      const [listaCaminhoes, listaMotoristas] = await Promise.all([
        api('/caminhoes'),
        api('/motoristas'),
      ]);
      setCaminhoes(listaCaminhoes);
      setMotoristas(listaMotoristas);
    } catch (e) {
      // catch = se qualquer uma das duas falhar, cai aqui.
      setErro('Não foi possível carregar os caminhões. Verifique se o servidor está ligado.');
    } finally {
      // finally = roda SEMPRE (deu certo ou errado): some a rodinha de carregamento.
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  // Recarrega a lista toda vez que a aba é aberta.
  // (Ex.: o admin cadastrou um motorista em outra tela e voltou: ele já aparece aqui.)
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  // Quantos caminhões há em cada situação (usado nos cartões do topo).
  // useMemo: só recalcula quando a lista "caminhoes" muda (e não a cada letra digitada na busca).
  // filter(...) devolve só os itens que passam no teste; .length conta quantos são.
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
  // O filtro é feito AQUI na tela (a lista já está toda carregada), sem chamar a API de novo.
  const filtrados = useMemo(() => {
    // trim() tira espaços das pontas; toLowerCase() deixa minúsculo (busca sem diferenciar maiúscula).
    const termo = busca.trim().toLowerCase();
    return caminhoes.filter((c) => {
      // 1º teste: se escolheu um status no cartão, descarta os outros.
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
      // Sem texto na busca: passa.
      if (!termo) return true;
      // 2º teste: o texto aparece na placa OU no modelo OU no nome do motorista?
      // "c.motorista?.nome ?? ''" = se o caminhão não tem motorista, usa texto vazio (não dá erro).
      return (
        c.placa.toLowerCase().includes(termo) ||
        c.modelo.toLowerCase().includes(termo) ||
        (c.motorista?.nome ?? '').toLowerCase().includes(termo)
      );
    });
  }, [caminhoes, busca, filtroStatus]); // refaz quando qualquer um destes três mudar

  // Motoristas que podem ser escolhidos: ativos e sem caminhão, mais o que já conduz este caminhão.
  // (Mesma regra do backend: um motorista só pode ser responsável por um caminhão.)
  const motoristasDisponiveis = useMemo(() => {
    // Se está editando um caminhão existente, guarda o id do motorista atual dele.
    const idDele = editando && editando !== 'novo' ? editando.motorista_id : null;
    // m.caminhao vem da API de motoristas (o caminhão que ele já conduz, ou null).
    return motoristas.filter((m) => m.id === idDele || (m.ativo && !m.caminhao));
  }, [motoristas, editando]);

  // Muda UM campo do formulário mantendo os outros.
  // "...atual" copia todos os campos; "[campo]: valor" sobrescreve só o campo pedido
  // (os colchetes usam o CONTEÚDO da variável campo como nome da chave).
  // setForm((atual) => ...) usa o valor mais recente do estado (forma segura de atualizar).
  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  // Abre o formulário vazio para cadastrar.
  const abrirNovo = () => {
    setForm(formVazio());
    setErroForm(null);
    setConfirmando(false);
    setEditando('novo'); // isto abre o Modal
  };

  // Abre o formulário preenchido com os dados do caminhão tocado.
  // Os números viram texto (String) porque o TextInput só aceita texto.
  const abrirEdicao = (c) => {
    setForm({
      placa: c.placa,
      modelo: c.modelo,
      ano: String(c.ano),
      // O banco devolve a capacidade como decimal ("600.00"): Number converte e
      // Math.round arredonda, para o campo mostrar "600" (o campo só aceita números inteiros).
      capacidade_tanque: String(Math.round(Number(c.capacidade_tanque))),
      km_atual: String(c.km_atual),
      status: c.status,
      motorista_id: c.motorista_id ?? null,
    });
    setErroForm(null);
    setConfirmando(false);
    setEditando(c); // guarda o caminhão inteiro (precisamos do id para o PUT e o DELETE)
  };

  // Fecha o formulário e limpa as mensagens.
  const fechar = () => {
    setEditando(null); // null = Modal fechado
    setErroForm(null);
    setConfirmando(false);
  };

  // Botão "Salvar": confere, monta os dados e envia para a API.
  const salvar = async () => {
    // Campos obrigatórios. "return" para a função aqui (não envia nada).
    if (!form.placa.trim() || !form.modelo.trim() || !form.ano || !form.capacidade_tanque || form.km_atual === '') {
      setErroForm('Preencha todos os campos.');
      return;
    }
    // Conferências rápidas antes de enviar (o servidor confere de novo).
    // Modelo precisa ter pelo menos 2 letras: "." ou "123" não são nome de modelo.
    if (contarLetras(form.modelo) < 2) {
      setErroForm('O modelo precisa ter um nome (pelo menos 2 letras). Ex.: Volvo FH 540.');
      return;
    }
    // Number(...) converte o texto do campo em número para comparar.
    const ano = Number(form.ano);
    if (ano < 1980 || ano > ANO_MAXIMO) {
      setErroForm(`O ano deve estar entre 1980 e ${ANO_MAXIMO}.`);
      return;
    }
    // Faixa realista de tanque de caminhão (mesma regra do backend).
    const capacidade = Number(form.capacidade_tanque);
    if (capacidade < 50 || capacidade > 2000) {
      setErroForm('A capacidade do tanque deve ficar entre 50 e 2.000 litros.');
      return;
    }

    // "corpo" = os dados que vão para a API (o api() transforma em JSON).
    // Aqui os textos dos campos viram números de verdade.
    const corpo = {
      placa: form.placa.trim(),
      modelo: form.modelo.trim(),
      ano: Number(form.ano),
      // replace(',', '.') = se houvesse vírgula decimal, vira ponto (formato que o JavaScript entende).
      capacidade_tanque: Number(String(form.capacidade_tanque).replace(',', '.')),
      km_atual: Number(form.km_atual),
      status: form.status,
      motorista_id: form.motorista_id,
    };

    setSalvando(true); // mostra a rodinha no botão e trava os cliques
    setErroForm(null);
    try {
      // Cadastro -> POST /caminhoes | Alteração -> PUT /caminhoes/{id}
      if (editando === 'novo') {
        await api('/caminhoes', { metodo: 'POST', corpo });
      } else {
        await api(`/caminhoes/${editando.id}`, { metodo: 'PUT', corpo });
      }
      fechar();
      await carregar(); // recarrega a lista para mostrar o que foi salvo
    } catch (e) {
      // Erro de validação do backend (422) ou de conexão: mostra no formulário, que continua aberto.
      setErroForm(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  // Botão "Excluir caminhão".
  const excluir = async () => {
    // Primeiro toque: pede confirmação. Segundo toque: exclui.
    // (Evita excluir sem querer, sem precisar de janela de confirmação do navegador.)
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
      // Ex.: o backend responde 409 quando o caminhão tem histórico
      // ("Mude o status para inativo em vez de excluir").
      setErroForm(mensagemDe(e));
      setConfirmando(false);
    } finally {
      setSalvando(false);
    }
  };

  // ---------- O que aparece na tela (JSX) ----------
  // JSX = "HTML dentro do JavaScript". O que está entre { } é código JavaScript.
  return (
    <View style={styles.tela}>
      {/* Cabeçalho vermelho; o que fica entre <Cabecalho> e </Cabecalho> aparece à direita (botão "+ Novo") */}
      <Cabecalho titulo="GESTÃO DE FROTA">
        <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
          <Text style={styles.botaoNovoTexto}>+ Novo</Text>
        </Pressable>
      </Cabecalho>

      {/* Cartões com o resumo da frota: tocar em um deles filtra a lista */}
      {/* Cada item da lista é [valor do filtro, texto, cor]. O .map transforma cada um em um cartão. */}
      {/* "key" identifica cada cartão para o React (obrigatório em listas). */}
      {/* O cartão escolhido ganha uma borda na cor dele. */}
      <View style={styles.cartoes}>
        {[
          ['todos', 'Total', cores.primaria],
          ['ativo', 'Ativos', cores.ativo],
          ['manutencao', 'Manutenção', cores.primaria],
          ['inativo', 'Inativos', cores.textoSecundario],
        ].map(([valor, rotulo, cor]) => (
          <Pressable
            key={valor}
            onPress={() => setFiltroStatus(valor)}
            style={[styles.cartaoFiltro, filtroStatus === valor && { borderColor: cor, borderWidth: 2 }]}
          >
            {/* contagem[valor] = pega a quantidade calculada no useMemo "contagem" */}
            <Text style={[styles.cartaoNumero, { color: cor }]}>{contagem[valor]}</Text>
            <Text style={styles.cartaoRotulo}>{rotulo}</Text>
          </Pressable>
        ))}
      </View>

      {/* Campo de busca: cada letra digitada muda "busca", e o useMemo "filtrados" refaz a lista */}
      <TextInput
        style={styles.busca}
        placeholder="Buscar caminhão (placa, modelo ou motorista)"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* "condição && <Componente>" = só mostra se a condição for verdadeira */}
      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      {/* Lista dos caminhões (já filtrada) */}
      {/* data = os itens; keyExtractor = a "key" de cada item (o id); */}
      {/* ListEmptyComponent = o que mostrar quando a lista estiver vazia; */}
      {/* renderItem = como desenhar cada caminhão (um cartão que, ao tocar, abre a edição). */}
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
            {/* item.motorista vem do with('motorista:id,nome') do backend; sem motorista mostra o texto padrão */}
            <Text style={styles.detalhe}>Motorista: {item.motorista?.nome ?? 'sem motorista'}</Text>
          </Pressable>
        )}
      />

      {/* Formulário de cadastro e edição */}
      {/* visible = abre quando "editando" não é null; onRequestClose = botão voltar do celular fecha. */}
      <Modal visible={editando !== null} animationType="slide" onRequestClose={fechar}>
        <Moldura>
        {/* keyboardShouldPersistTaps="handled" = no celular, tocar num botão funciona mesmo com o teclado aberto */}
        <ScrollView
          style={styles.tela}
          contentContainerStyle={styles.formConteudo}
          keyboardShouldPersistTaps="handled"
        >
          {/* O título muda conforme o modo; aoVoltar mostra a seta de voltar que fecha o formulário */}
          <Cabecalho titulo={editando === 'novo' ? 'Novo caminhão' : 'Editar caminhão'} aoVoltar={fechar} />

          {/* Placa: tudo maiúsculo, só letras e números, no máximo 7 caracteres (slice(0, 7)) */}
          <Campo
            rotulo="Placa"
            value={form.placa}
            onChangeText={(v) => mudar('placa', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))}
            placeholder="ABC1234 ou ABC1D23"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
          />
          {/* Os campos abaixo já limpam o que for digitado: caractere inválido nem aparece. */}
          {/* Modelo: limparModelo remove caracteres especiais (@, #, !...) enquanto digita */}
          <Campo
            rotulo="Modelo"
            value={form.modelo}
            onChangeText={(v) => mudar('modelo', limparModelo(v))}
            placeholder="Ex.: Volvo FH 540"
            maxLength={60}
          />
          {/* Ano: só números, até 4 dígitos. keyboardType="numeric" abre o teclado numérico no celular */}
          <Campo
            rotulo={`Ano (1980 a ${ANO_MAXIMO})`}
            value={form.ano}
            onChangeText={(v) => mudar('ano', soNumeros(v))}
            keyboardType="numeric"
            maxLength={4}
          />
          {/* Capacidade: só números, até 4 dígitos (o máximo aceito é 2000) */}
          <Campo
            rotulo="Capacidade do tanque (50 a 2.000 litros)"
            value={form.capacidade_tanque}
            onChangeText={(v) => mudar('capacidade_tanque', soNumeros(v))}
            placeholder="Ex.: 600"
            keyboardType="numeric"
            maxLength={4}
          />
          {/* Quilometragem: só números, até 7 dígitos (até 9.999.999 km, igual ao backend) */}
          <Campo
            rotulo="Quilometragem atual"
            value={form.km_atual}
            onChangeText={(v) => mudar('km_atual', soNumeros(v))}
            keyboardType="numeric"
            maxLength={7}
          />

          {/* Status: três botões lado a lado; o escolhido fica preenchido com a cor do status */}
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

          {/* Motorista: "Nenhum" + os motoristas disponíveis (useMemo motoristasDisponiveis) */}
          <Text style={styles.rotulo}>Motorista responsável</Text>
          <View style={styles.opcoesQuebra}>
            <Opcao
              texto="Nenhum"
              ativo={form.motorista_id === null}
              aoTocar={() => mudar('motorista_id', null)}
            />
            {motoristasDisponiveis.map((m) => (
              <Opcao
                key={m.id}
                texto={m.nome}
                ativo={form.motorista_id === m.id}
                aoTocar={() => mudar('motorista_id', m.id)}
              />
            ))}
          </View>

          {/* Mensagem de erro (da conferência da tela ou do backend) */}
          {erroForm && <Text style={styles.erroForm}>{erroForm}</Text>}

          {/* Salvar: enquanto envia, fica apagado (desativado) e mostra a rodinha no lugar do texto */}
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

          {/* Excluir só aparece na edição (não faz sentido excluir algo que ainda não foi cadastrado). */}
          {/* No primeiro toque o botão fica vermelho e muda o texto; no segundo, exclui. */}
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
        </Moldura>
      </Modal>
    </View>
  );
}

// ---------- Estilos ----------
// StyleSheet.create = parecido com CSS, mas os nomes são em camelCase (backgroundColor
// em vez de background-color) e os números são em pixels (sem "px").
// flexDirection: 'row' = itens lado a lado; flex: 1 = ocupa o espaço que sobrar;
// gap = espaço entre os itens; cores vêm do tema (cores.primaria, cores.texto...).
// Alguns estilos (cabecalho, titulo, tituloTela) sobraram da versão antiga e não são mais usados.
const styles = StyleSheet.create({
  // paddingTop: 56 = espaço para o Cabecalho vermelho (que usa margens negativas para encostar no topo).
  tela: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 16, paddingTop: 56 },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titulo: { fontSize: 24, fontWeight: 'bold', color: cores.texto },
  tituloTela: { fontSize: 20, fontWeight: 'bold', color: cores.texto, flexShrink: 1, marginRight: 8 },
  // Cartões do topo (Total / Ativos / Manutenção / Inativos)
  cartoes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cartaoFiltro: {
    flex: 1, // os 4 cartões dividem a largura igualmente
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent', // borda invisível; fica colorida quando o cartão é escolhido
    paddingVertical: 10,
    alignItems: 'center',
  },
  cartaoNumero: { fontSize: 22, fontWeight: 'bold' },
  cartaoRotulo: { fontSize: 12, color: cores.textoSecundario, marginTop: 2 },
  // Botão "+ Novo" dentro do cabeçalho vermelho (branco semitransparente)
  botaoNovo: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
  busca: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  erro: { color: cores.perigo, marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: cores.textoSecundario, marginTop: 40 },
  // Cartão de cada caminhão na lista
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  placa: { fontSize: 18, fontWeight: 'bold', color: cores.texto },
  modelo: { fontSize: 15, color: cores.texto, marginTop: 4 },
  detalhe: { fontSize: 13, color: cores.textoSecundario, marginTop: 4 },
  // borderRadius: 999 = cantos totalmente arredondados (formato de "pílula")
  etiqueta: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  etiquetaTexto: { fontSize: 12, fontWeight: '600' },

  // ----- Formulário -----
  // maxWidth + alignSelf: 'center' = em tela grande o formulário não estica demais e fica centralizado.
  formConteudo: { paddingBottom: 40, width: '100%', maxWidth: 520, alignSelf: 'center' },
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
  // Botões de status (lado a lado, mesma largura)
  opcoes: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  opcao: {
    flex: 1,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: cores.textoMedio },
  // Botões de motorista: flexWrap: 'wrap' = quando não cabe na linha, quebra para a de baixo
  opcoesQuebra: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  opcaoSimples: {
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  opcaoSimplesAtiva: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  opcaoSimplesTexto: { fontSize: 14, fontWeight: '600', color: cores.textoMedio },
  erroForm: { color: cores.perigo, marginBottom: 12 },
  botao: { backgroundColor: cores.primaria, borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 }, // botão "apagado" enquanto salva
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: cores.textoMedio, fontSize: 16, fontWeight: '600' },
  // Botão excluir: só a borda vermelha; no 2º passo (botaoExcluirAtivo) fica todo vermelho.
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