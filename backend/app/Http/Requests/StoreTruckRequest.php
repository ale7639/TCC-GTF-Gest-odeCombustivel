<?php

namespace App\Http\Requests;

use App\Support\Plate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreTruckRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('plate')) {
            $this->merge(['plate' => Plate::normalize($this->input('plate'))]);
        }
    }

    public function rules(): array
    {
        return [
            'plate' => ['required', 'string', 'max:8', 'unique:trucks,plate'],
            'name' => ['required', 'string', 'max:80'],
            'model' => ['required', 'string', 'max:80'],
            'fuel_type' => ['required', 'string', 'max:40'],
            'tank_capacity' => ['required', 'numeric', 'min:50', 'max:2000'],
            'current_km' => ['required', 'integer', 'min:0'],
            'sector' => ['required', 'string', 'max:80'],
            'driver_id' => ['nullable', 'exists:users,id'],
            'wash_frequency_days' => ['nullable', 'integer', 'min:1', 'max:30'],
            'crlv_expires_at' => ['nullable', 'date'],
            'insurance_expires_at' => ['nullable', 'date'],
            'license_expires_at' => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'plate.unique' => 'Placa já cadastrada — Este caminhão já está registrado no sistema.',
            'name.required' => 'Informe o nome/identificação do caminhão.',
            'model.required' => 'Informe o modelo.',
            'fuel_type.required' => 'Informe o tipo de combustível.',
            'tank_capacity.required' => 'Informe a capacidade do tanque.',
            'current_km.required' => 'Informe a quilometragem atual.',
            'sector.required' => 'Informe o setor/operação.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->filled('plate') && ! Plate::isValid($this->input('plate'))) {
                $validator->errors()->add(
                    'plate',
                    'Placa deve seguir o formato AAA-9999 ou AAA9A99.'
                );
            }
        });
    }
}
