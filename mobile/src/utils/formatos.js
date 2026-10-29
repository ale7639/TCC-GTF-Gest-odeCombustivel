// Máscaras e formatos usados nos formulários.

// Deixa só os números: "096.668.979-89" -> "09666897989"
export const somenteDigitos = (texto) => String(texto ?? '').replace(/\D/g, '');

// CPF enquanto digita: "09666897989" -> "096.668.979-89"
export const mascaraCPF = (texto) => {
  const d = somenteDigitos(texto).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

// Número -> "R$ 1.234,56"
export const moeda = (n) =>
  'R$ ' +
  Number(n)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Valor em reais enquanto digita (como em app de banco: os números entram pelos centavos).
// "8" -> "R$ 0,08" | "89" -> "R$ 0,89" | "890" -> "R$ 8,90"
export const mascaraMoeda = (texto) => {
  const d = somenteDigitos(texto).replace(/^0+/, '').slice(0, 11);
  return d ? moeda(Number(d) / 100) : '';
};

// "R$ 1.234,56" -> 1234.56 | "" -> NaN
export const moedaParaNumero = (texto) => {
  const d = somenteDigitos(texto);
  return d ? Number(d) / 100 : NaN;
};

// Número -> texto já mascarado, para preencher um formulário de edição. 8.9 -> "R$ 8,90"
export const numeroParaMascara = (n) => (n == null || n === '' ? '' : moeda(n));