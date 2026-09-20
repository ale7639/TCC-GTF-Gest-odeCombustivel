<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMaintenanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->canManageFleet() ?? false;
    }

    public function rules(): array
    {
        return [
            'service_date' => ['required', 'date', 'before_or_equal:today'],
            'km' => ['required', 'integer', 'min:0'],
            'description' => ['required', 'string', 'max:255'],
            'next_date' => ['nullable', 'date', 'after:service_date'],
            'next_km' => ['nullable', 'integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'service_date.before_or_equal' => 'A data do serviço não pode ser uma data futura.',
            'description.required' => 'Descreva o serviço realizado.',
        ];
    }
}
