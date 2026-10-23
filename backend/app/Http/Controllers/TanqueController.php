<?php

namespace App\Http\Controllers;

use App\Models\Tanque;
use Illuminate\Http\JsonResponse;

class TanqueController extends Controller
{
    // GET /api/tanques — lista os tanques da empresa com o nível atual.
    public function index(): JsonResponse
    {
        return response()->json(Tanque::orderBy('nome')->get());
    }
}