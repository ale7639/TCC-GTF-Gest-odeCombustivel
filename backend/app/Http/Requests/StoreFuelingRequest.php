<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFuelingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->role, ['administrador', 'supervisor', 'motorista'], true);
    }

    public function rules(): array
    {
        return [
            'truck_id' => ['required', 'exists:trucks,id'],
            'quantity' => ['required', 'numeric', 'min:1'],
            'current_liters' => ['nullable', 'numeric', 'min:0'],
            'current_km' => ['nullable', 'integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'truck_id.required' => 'Selecione um caminhão.',
            'quantity.required' => 'Informe a quantidade em litros.',
            'quantity.min' => 'A quantidade deve ser um valor positivo.',
        ];
    }
}
