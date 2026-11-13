import { armazenamento } from './storage';
import { API_URL } from './config';

// Função chamada quando o servidor recusa o token (sessão vencida ou inválida).
// O AuthContext registra aqui o que deve acontecer nesse caso (voltar para o login).
let aoExpirar = () => {};
export const definirAoExpirar = (funcao) => {
  aoExpirar = funcao;
};

// Único ponto do app que conversa com a API.
// Uso: await api('/dashboard')  |  await api('/login', { metodo: 'POST', corpo: { ... } })
// Para enviar arquivo (foto), passe um FormData como corpo.
export async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const token = await armazenamento.ler('token');
  const ehFormulario = typeof FormData !== 'undefined' && corpo instanceof FormData;

  // Se o servidor não responder a tempo, cancela (envio de foto precisa de mais tempo).
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), ehFormulario ? 60000 : 8000);

  let resposta;
  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      method: metodo,
      headers: {
        Accept: 'application/json', // faz o Laravel responder sempre em JSON
        // Com FormData o navegador define sozinho o Content-Type (com o "boundary" do arquivo).
        ...(ehFormulario ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo ? (ehFormulario ? corpo : JSON.stringify(corpo)) : undefined,
      signal: controle.signal,
    });
  } catch (e) {
    // Servidor desligado, sem internet ou demorou demais: mensagem clara em vez de erro técnico.
    throw new Error(
      e.name === 'AbortError'
        ? 'O servidor demorou para responder. Tente novamente.'
        : 'Não foi possível conectar ao servidor. Verifique se ele está ligado.'
    );
  } finally {
    clearTimeout(timer);
  }

  const json = await resposta.json().catch(() => null);

  // 401 com token guardado = sessão expirou ou não vale mais; volta para o login.
  if (resposta.status === 401 && token) {
    aoExpirar();
    throw new Error('Sua sessão expirou. Entre novamente.');
  }

  if (!resposta.ok) throw new Error(mensagemDeErro(resposta.status, json));
  return json;
}

// Traduz o código de erro HTTP numa mensagem que o usuário entende.
function mensagemDeErro(status, json) {
  if (status === 429) return 'Muitas tentativas seguidas. Aguarde 1 minuto e tente novamente.';
  if (status === 403) return json?.message || 'Você não tem permissão para fazer isso.';
  if (status === 404) return 'Registro não encontrado. Ele pode ter sido excluído.';
  if (status >= 500) return 'Erro interno no servidor. Tente novamente em instantes.';

  // 422 (validação): mostra só a primeira mensagem, sem o "(e mais N erros)".
  const erros = json?.errors ? Object.values(json.errors).flat() : [];
  if (erros.length > 0) return erros[0];

  return json?.message || `Não foi possível concluir a operação (erro ${status}).`;
}