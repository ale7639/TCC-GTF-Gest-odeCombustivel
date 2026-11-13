import { Platform } from 'react-native';
import { armazenamento } from '../storage';
import { API_URL } from '../config';

// Baixa um arquivo (CSV) da API com o token da sessão.
// Na web dispara o download no navegador; no app nativo abre o conteúdo como data URL.
export async function baixarArquivo(caminho, nomeArquivo) {
  const token = await armazenamento.ler('token');
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), 30000);

  let resposta;
  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      method: 'GET',
      headers: {
        Accept: 'text/csv,application/octet-stream,*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controle.signal,
    });
  } catch (e) {
    throw new Error(
      e.name === 'AbortError'
        ? 'O servidor demorou para responder. Tente novamente.'
        : 'Não foi possível conectar ao servidor. Verifique se ele está ligado.'
    );
  } finally {
    clearTimeout(timer);
  }

  if (!resposta.ok) {
    let msg = `Não foi possível baixar o arquivo (erro ${resposta.status}).`;
    try {
      const json = await resposta.json();
      if (json?.message) msg = json.message;
    } catch (_) {}
    throw new Error(msg);
  }

  const texto = await resposta.text();
  const nome =
    nomeArquivo ||
    (resposta.headers.get('Content-Disposition') || '').match(/filename="?([^"]+)"?/i)?.[1] ||
    'relatorio.csv';

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob(['\uFEFF' + texto.replace(/^\uFEFF/, '')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return nome;
  }

  // Fallback nativo: abre o CSV em nova aba / visualizador.
  const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(texto)}`;
  if (typeof window !== 'undefined' && window.open) {
    window.open(dataUrl, '_blank');
  }
  return nome;
}
