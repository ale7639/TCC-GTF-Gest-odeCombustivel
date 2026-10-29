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

  try {
    const resposta = await fetch(`${API_URL}${caminho}`, {
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

    const json = await resposta.json().catch(() => null);

    // 401 com token guardado = sessão não vale mais; volta para o login.
    if (resposta.status === 401 && token) aoExpirar();

    if (!resposta.ok) throw new Error(json?.message || `Erro ${resposta.status}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}