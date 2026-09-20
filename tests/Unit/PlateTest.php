<?php

namespace Tests\Unit;

use App\Support\Plate;
use PHPUnit\Framework\TestCase;

class PlateTest extends TestCase
{
    public function test_normalizes_old_format(): void
    {
        $this->assertSame('ABC-1234', Plate::normalize('abc1234'));
        $this->assertTrue(Plate::isValid('ABC-1234'));
    }

    public function test_accepts_mercosul_format(): void
    {
        $this->assertSame('ABC1D23', Plate::normalize('abc1d23'));
        $this->assertTrue(Plate::isValid('ABC1D23'));
    }

    public function test_rejects_invalid_plate(): void
    {
        $this->assertFalse(Plate::isValid('ABC12'));
    }
}
