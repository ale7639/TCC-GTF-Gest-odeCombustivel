<?php

// =====================================================================================
// CaminhaoController — CRUD de caminhões (cadastrar, listar, ver, alterar e excluir).
//
// Rotas (definidas em routes/api.php com Route::apiResource('caminhoes', ...)):
//   GET    /api/caminhoes          -> index()   lista todos
//   POST   /api/caminhoes          -> store()   cadastra
//   GET    /api/caminhoes/{id}     -> show()    mostra um
//   PUT    /api/caminhoes/{id}     -> update()  altera
//   DELETE /api/caminhoes/{id}     -> destroy() exclui
// Todas ficam dentro do grupo do ADMIN (middleware ApenasAdmin) e exigem login (auth:sanctum).
// =====================================================================================

// namespace = "endereço" da classe no projeto; o Laravel usa para encontrar o arquivo.
namespace App\Http\Controllers;

// "use" importa as classes usadas aqui (para escrever só "Caminhao" em vez do caminho completo).
use App\Models\Caminhao;             // Model: representa a tabela "caminhoes"
use Illuminate\Http\JsonResponse;    // tipo de resposta: JSON
use Illuminate\Http\Request;         // dados que chegaram da tela (corpo da requisição)
use Illuminate\Validation\Rule;      // regras de validação mais elaboradas (unique, in...)

// "extends Controller": herda a classe base de controllers do Laravel.
class CaminhaoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // with('motorista:id,nome') = "eager loading": já traz o motorista de cada caminhão
        // numa consulta só (evita uma consulta por caminhão — o problema "N+1").
        // ":id,nome" = só essas colunas do motorista (resposta mais leve).
        // orderBy('placa') = em ordem alfabética de placa.
        $caminhoes = Caminhao::with('motorista:id,nome')->orderBy('placa')->get();

        // response()->json(...) transforma a lista em JSON (código HTTP 200 = ok).
        return response()->json($caminhoes);
    }

    public function store(Request $request): JsonResponse
    {
        // 1) $this->validar(...) confere os dados (se algo estiver errado, o Laravel já
        //    responde 422 com a mensagem e o resto NÃO executa).
        // 2) Caminhao::create(...) grava no banco só os campos validados.
        $caminhao = Caminhao::create($this->validar($request));
        Auditoria::registrar('caminhao.criar', $caminhao, ['placa' => $caminhao->placa]);

        // load(...) carrega o motorista para devolver junto. 201 = código HTTP "criado".
        return response()->json($caminhao->load('motorista:id,nome'), 201);
    }

    // GET /api/caminhoes/{id} — um caminhão só.
    // "Caminhao $caminhao" = route model binding: o Laravel pega o {id} da URL, busca no
    // banco e entrega o objeto pronto. Se não existir, responde 404 sozinho.
    public function show(Caminhao $caminhao): JsonResponse
    {
        $this->authorize('view', $caminhao);
        $caminhao->load('motorista:id,nome,cpf,cnh,telefone,ativo');
        $abastecimentos = $caminhao->abastecimentos()
            ->with(['tanque:id,nome', 'motorista:id,nome'])
            ->orderByDesc('data')
            ->orderByDesc('id')
            ->limit(30)
            ->get();

        $anteriores = $caminhao->abastecimentos()->orderBy('km')->orderBy('data')->orderBy('id')->get();
        $porId = Consumo::trechos($anteriores)->keyBy('abastecimento_id');
        $abastecimentos->transform(function ($item) use ($porId) {
            $item->setAttribute('km_l', $porId[$item->id]['km_l'] ?? null);

            return $item;
        });

        return response()->json($caminhao->toArray() + [
            'abastecimentos' => $abastecimentos,
            'media_km_l' => $caminhao->media_km_l,
        ]);
    }

    public function update(Request $request, Caminhao $caminhao): JsonResponse
    {
        // Passa o próprio caminhão para a validação: assim a regra "placa única"
        // ignora a placa dele mesmo (senão acusaria duplicidade ao salvar sem mudar a placa).
        $caminhao->update($this->validar($request, $caminhao));
        Auditoria::registrar('caminhao.editar', $caminhao, ['placa' => $caminhao->placa]);

        return response()->json($caminhao->load('motorista:id,nome,telefone'));
    }

    public function destroy(Caminhao $caminhao): JsonResponse
    {
        // exists() pergunta ao banco "existe pelo menos um?" (mais rápido que contar).
        // "||" = OU: basta ter qualquer um dos três históricos.
        $temHistorico = $caminhao->abastecimentos()->exists()
            || $caminhao->lavagens()->exists()
            || $caminhao->manutencoes()->exists();

        // Regra de negócio: não apaga caminhão com histórico, para não perder os registros
        // (relatórios, consumo, gastos). 409 = código HTTP "conflito".
        if ($temHistorico) {
            $caminhao->update(['status' => 'inativo', 'motorista_id' => null]);
            Auditoria::registrar('caminhao.desativar', $caminhao);

            return response()->json([
                'message' => 'Este caminhão tem histórico. Ele foi desativado em vez de excluído.',
                'caminhao' => $caminhao->fresh('motorista'),
            ]);
        }

        $caminhao->delete();
        Auditoria::registrar('caminhao.excluir', $caminhao);

        return response()->json(['message' => 'Caminhão excluído.']);
    }

    // Regras de validação, iguais para cadastrar e para alterar.
    // "private" = só esta classe usa. "?Caminhao $caminhao = null" = parâmetro opcional:
    // null no cadastro, o caminhão atual na alteração.
    private function validar(Request $request, ?Caminhao $caminhao = null): array
    {
        // Padroniza a placa: maiúsculas e sem traço ou espaço (ABC-1D23 vira ABC1D23).
        // filled('placa') = o campo veio e não está vazio.
        // merge([...]) troca o valor dentro da requisição antes de validar.
        if ($request->filled('placa')) {
            $request->merge([
                'placa' => strtoupper(str_replace(['-', ' '], '', $request->input('placa'))),
            ]);
        }

        // Modelo: tira espaços das pontas e espaços repetidos ("Volvo   FH" vira "Volvo FH").
        // preg_replace('/\s+/', ' ', ...) = troca qualquer sequência de espaços por um só.
        if ($request->filled('modelo')) {
            $request->merge(['modelo' => preg_replace('/\s+/', ' ', trim($request->input('modelo')))]);
        }

        // validate(regras, mensagens, nomes dos campos):
        // se tudo estiver certo, devolve só os campos validados (o que vai para o banco);
        // se não, responde 422 com a primeira mensagem de erro.
        return $request->validate([
            'placa' => [
                // regex = padrão de texto: 3 letras + 1 número + letra ou número + 2 números
                // (placa antiga ABC1234 ou Mercosul ABC1D23).
                'required', 'string', 'regex:/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/',
                // Placa única na tabela, ignorando o próprio caminhão quando é alteração.
                // "?->" = se $caminhao for null (cadastro), não dá erro: vira null.
                Rule::unique('caminhoes', 'placa')->ignore($caminhao?->id),
            ],
            // Modelo: letras (com acento), números, espaço, hífen, ponto e barra — e pelo menos 2 letras.
            // Números são permitidos porque fazem parte do nome dos modelos (ex.: "Volvo FH 540").
            'modelo' => [
                'required', 'string', 'min:2', 'max:60',
                // \pL = qualquer letra (inclusive á, ç...). O "u" no fim liga o modo Unicode.
                'regex:/^[\pL0-9 .\/-]+$/u',
                // Regra personalizada (função): conta as letras; se tiver menos de 2, recusa.
                // Assim "." ou "123" não passam, mesmo só tendo caracteres permitidos.
                function ($atributo, $valor, $falhar) {
                    if (preg_match_all('/\pL/u', (string) $valor) < 2) {
                        $falhar('O modelo precisa ter um nome (pelo menos 2 letras). Ex.: Volvo FH 540.');
                    }
                },
            ],
            // date('Y') + 1 = ano que vem (aceita caminhão modelo do próximo ano).
            'ano'               => ['required', 'integer', 'between:1980,' . (date('Y') + 1)],
            // Capacidade realista do tanque de um caminhão.
            'capacidade_tanque' => ['required', 'numeric', 'between:50,2000'],
            'km_atual'          => ['required', 'integer', 'min:0', 'max:9999999'],
            // Rule::in = só aceita um destes três valores.
            'status'            => ['required', Rule::in(['ativo', 'manutencao', 'inativo'])],
            'motorista_id'      => [
                // nullable = pode vir vazio (caminhão sem motorista).
                // exists = o motorista precisa existir na tabela motoristas.
                'nullable', 'integer', 'exists:motoristas,id',
                // Um motorista só pode ser responsável por UM caminhão.
                Rule::unique('caminhoes', 'motorista_id')->ignore($caminhao?->id),
            ],
        ], [
            // Mensagens em português para cada regra que pode falhar ("campo.regra" => "mensagem").
            'placa.unique'        => 'Já existe um caminhão com esta placa.',
            'placa.regex'         => 'Placa inválida. Use ABC1234 ou o padrão Mercosul ABC1D23.',
            'motorista_id.unique' => 'Este motorista já é responsável por outro caminhão.',
            'motorista_id.exists' => 'Motorista não encontrado.',
            'modelo.regex'        => 'O modelo aceita só letras, números, espaço, hífen (-), ponto (.) e barra (/).',
            'modelo.min'          => 'O modelo precisa ter pelo menos 2 caracteres.',
            'ano.between'         => 'O ano deve estar entre 1980 e ' . (date('Y') + 1) . '.',
            'capacidade_tanque.between' => 'A capacidade do tanque deve ficar entre 50 e 2.000 litros.',
            'km_atual.min'        => 'A quilometragem não pode ser negativa.',
            'km_atual.max'        => 'Quilometragem inválida.',
            // ":attribute" é trocado pelo nome do campo (ex.: "Preencha o campo modelo.").
            'required'            => 'Preencha o campo :attribute.',
        ], [
            // Nomes amigáveis usados no lugar de ":attribute" nas mensagens.
            'capacidade_tanque' => 'capacidade do tanque',
            'km_atual'          => 'quilometragem',
        ]);
    }
}
