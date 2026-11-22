<?php

// =====================================================================================
// Controller — classe BASE de todos os controllers (veio pronta com o Laravel).
//
// Todos os nossos controllers fazem "extends Controller", ou seja, HERDAM desta classe.
// Ela está vazia: serve só como ponto comum. Se um dia vários controllers precisassem
// de um mesmo método, ele poderia ser escrito aqui uma vez só.
// "abstract" = não dá para criar um objeto direto desta classe; ela só serve para ser herdada.
// =====================================================================================

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

abstract class Controller
{
    //
}