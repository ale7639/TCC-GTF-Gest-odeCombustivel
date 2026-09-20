<?php

namespace App\Http\Requests;

use App\Support\Plate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateTruckRequest extends FormRequest
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
        $truckId = $this->route('truck')?->id ?? $this->route('id');

        return [
            'plate' => ['sometimes', 'required', 'string', 'max:8', 'unique:trucks,plate,'.$truckId],
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'model' => ['sometimes', 'required', 'string', 'max:80'],
            'fuel_type' => ['sometimes', 'required', 'string', 'max:40'],
            'tank_capacity' => ['sometimes', 'required', 'numeric', 'min:50', 'max:2000'],
            'current_km' => ['sometimes', 'required', 'integer', 'min:0'],
            'sector' => ['sometimes', 'required', 'string', 'max:80'],
            'driver_id' => ['nullable', 'exists:users,id'],
            'wash_frequency_days' => ['nullable', 'integer', 'min:1', 'max:30'],
            'crlv_expires_at' => ['nullable', 'date'],
            'insurance_expires_at' => ['nullable', 'date'],
            'license_expires_at' => ['nullable', 'date'],
            'status' => ['sometimes', 'in:ativo,inativo'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->filled('plate') && ! Plate::isValid($this->input('plate'))) {
                $validator->errors()->add('plate', 'Placa deve seguir o formato AAA-9999 ou AAA9A99.');
            }
        });
    }
}
