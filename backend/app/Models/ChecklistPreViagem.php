<?php

namespace App\Models;

use App\Support\StorageUrl;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class ChecklistPreViagem extends Model
{
    public const VALIDADE_HORAS = 24;

    protected $table = 'checklists_pre_viagem';

    protected $fillable = [
        'caminhao_id', 'motorista_id', 'user_id', 'data', 'status',
        'itens', 'foto_path', 'observacao', 'manutencao_id',
    ];

    protected $casts = [
        'data' => 'date',
        'itens' => 'array',
    ];

    protected $appends = ['foto_url', 'valido', 'expirado', 'expira_em'];

    public function caminhao(): BelongsTo
    {
        return $this->belongsTo(Caminhao::class);
    }

    public function motorista(): BelongsTo
    {
        return $this->belongsTo(Motorista::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function manutencao(): BelongsTo
    {
        return $this->belongsTo(Manutencao::class);
    }

    public function getFotoUrlAttribute(): ?string
    {
        return StorageUrl::public($this->foto_path);
    }

    public function momentoReferencia(): CarbonInterface
    {
        return $this->created_at ?? Carbon::parse($this->data)->startOfDay();
    }

    public function expiraEm(): CarbonInterface
    {
        return $this->momentoReferencia()->copy()->addHours(self::VALIDADE_HORAS);
    }

    public function estaValido(?CarbonInterface $agora = null): bool
    {
        $agora ??= now();

        return $agora->lt($this->expiraEm());
    }

    public function getValidoAttribute(): bool
    {
        return $this->estaValido();
    }

    public function getExpiradoAttribute(): bool
    {
        return ! $this->estaValido();
    }

    public function getExpiraEmAttribute(): string
    {
        return $this->expiraEm()->toIso8601String();
    }

    /** Último checklist do caminhão (por id) ainda dentro da validade de 24 h. */
    public static function vigenteDoCaminhao(int $caminhaoId, ?CarbonInterface $agora = null): ?self
    {
        $ultimo = static::query()
            ->where('caminhao_id', $caminhaoId)
            ->orderByDesc('id')
            ->first();

        if (! $ultimo || ! $ultimo->estaValido($agora)) {
            return null;
        }

        return $ultimo;
    }

    /** Resumo de vigência para painel / motorista. */
    public static function resumoVigencia(?int $caminhaoId, ?CarbonInterface $agora = null): array
    {
        $agora ??= now();
        if (! $caminhaoId) {
            return [
                'caminhao_id' => null,
                'valido' => false,
                'expirado' => true,
                'pendente' => true,
                'expira_em' => null,
                'ultimo' => null,
            ];
        }

        $ultimo = static::query()
            ->where('caminhao_id', $caminhaoId)
            ->orderByDesc('id')
            ->first();

        if (! $ultimo) {
            return [
                'caminhao_id' => $caminhaoId,
                'valido' => false,
                'expirado' => false,
                'pendente' => true,
                'expira_em' => null,
                'ultimo' => null,
            ];
        }

        $valido = $ultimo->estaValido($agora);

        return [
            'caminhao_id' => $caminhaoId,
            'valido' => $valido,
            'expirado' => ! $valido,
            'pendente' => ! $valido,
            'expira_em' => $ultimo->expiraEm()->toIso8601String(),
            'ultimo' => [
                'id' => $ultimo->id,
                'status' => $ultimo->status,
                'data' => $ultimo->data?->toDateString(),
                'created_at' => optional($ultimo->created_at)->toIso8601String(),
            ],
        ];
    }
}
