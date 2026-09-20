<?php

namespace App\Http\Requests;

use App\Support\PasswordRules;
use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'email' => ['required', 'email', 'max:160', 'unique:users,email'],
            'password' => ['required', 'string', 'confirmed', 'regex:'.PasswordRules::regex()],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Informe o nome completo.',
            'email.required' => 'Informe o e-mail.',
            'email.unique' => 'E-mail já cadastrado — Use outro e-mail ou faça login na sua conta.',
            'password.confirmed' => 'As senhas não coincidem.',
            'password.regex' => PasswordRules::message(),
        ];
    }
}
