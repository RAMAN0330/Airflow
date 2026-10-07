"""Hidden validation suite for mini_autograd."""
import math
import random

import pytest

import submission as sub

Value = sub.Value


def fd_grad(f, xs, h=1e-6):
    """Central finite differences of a plain-float function f at the point xs."""
    grads = []
    for i in range(len(xs)):
        up = list(xs)
        dn = list(xs)
        up[i] += h
        dn[i] -= h
        grads.append((f(*up) - f(*dn)) / (2 * h))
    return grads


def test_forward_values():
    a, b = Value(2.0), Value(-3.0)
    assert (a + b).data == -1.0 and (a * b).data == -6.0
    assert (a - b).data == 5.0 and (a / b).data == pytest.approx(-2 / 3)
    assert (a ** 3).data == 8.0 and (-a).data == -2.0
    assert (1 + a).data == 3.0 and (2 * a).data == 4.0 and (1 - a).data == -1.0 and (1 / a).data == 0.5
    assert a.exp().data == pytest.approx(math.exp(2.0))
    assert a.log().data == pytest.approx(math.log(2.0))
    assert b.tanh().data == pytest.approx(math.tanh(-3.0))
    assert a.relu().data == 2.0 and b.relu().data == 0.0
    assert Value(30.0).tanh().data == pytest.approx(1.0) and Value(-30.0).tanh().data == pytest.approx(-1.0)
    assert isinstance(Value(3).data, float) and Value(3).grad == 0.0


def test_basic_gradients():
    a, b, c = Value(2.0), Value(-3.0), Value(10.0)
    L = a * b + c                                  # dL/da = b, dL/db = a, dL/dc = 1
    L.backward()
    assert (a.grad, b.grad, c.grad, L.grad) == (-3.0, 2.0, 1.0, 1.0)
    x, y = Value(4.0), Value(2.0)
    z = x / y - (3 - y)                            # dz/dx = 1/y, dz/dy = -x/y² + 1
    z.backward()
    assert x.grad == pytest.approx(0.5) and y.grad == pytest.approx(0.0)
    w = Value(5.0)
    q = 1 / w                                      # d(1/w)/dw = -1/w²
    q.backward()
    assert w.grad == pytest.approx(-1 / 25)


def test_reused_node_accumulates():
    a = Value(3.0)
    (a + a).backward()
    assert a.grad == 2.0
    x = Value(3.0)
    (x * x).backward()
    assert x.grad == 6.0
    x = Value(3.0)
    y = x * x + x                                  # 2x + 1
    y.backward()
    assert x.grad == 7.0
    u = Value(-2.0)
    s = u * 2
    out = s * s + s.exp()                          # s used twice downstream
    out.backward()
    assert u.grad == pytest.approx(2 * (2 * -4.0) + 2 * math.exp(-4.0))


def test_power_rule():
    for p, x0 in [(3, 2.0), (2, -1.5), (-2, 4.0), (0.5, 9.0), (1, 7.0), (0, 3.0)]:
        x = Value(x0)
        y = x ** p
        y.backward()
        assert y.data == pytest.approx(x0 ** p)
        assert x.grad == pytest.approx(p * x0 ** (p - 1)), f"d/dx x**{p} at {x0}"


def test_unary_gradients():
    for x0 in (-1.3, 0.4, 2.0):
        x = Value(x0)
        x.tanh().backward()
        assert x.grad == pytest.approx(1 - math.tanh(x0) ** 2)
        x = Value(x0)
        x.exp().backward()
        assert x.grad == pytest.approx(math.exp(x0))
        x = Value(x0)
        x.relu().backward()
        assert x.grad == (1.0 if x0 > 0 else 0.0)
        x = Value(x0)
        (-x).backward()
        assert x.grad == -1.0
    x = Value(0.25)
    x.log().backward()
    assert x.grad == pytest.approx(4.0)


def test_deep_graph_needs_topological_order():
    # A chain where every node also feeds a skip connection further down: any order other than
    # reverse-topological runs a node's _backward before all of its gradient has arrived.
    x = Value(0.5)
    h = x
    nodes = [x]
    for i in range(40):
        h = (h * 0.9 + nodes[i // 2] * 0.1).tanh()
        nodes.append(h)
    h.backward()

    def f(x0):
        hs = [x0]
        h = x0
        for i in range(40):
            h = math.tanh(h * 0.9 + hs[i // 2] * 0.1)
            hs.append(h)
        return h
    assert x.grad == pytest.approx(fd_grad(f, [0.5])[0], rel=1e-6, abs=1e-10)
    assert abs(x.grad) > 1e-4


def test_matches_finite_differences():
    rng = random.Random(3)

    def expr(a, b, c):
        e = (a * b - c / (1 + b ** 2)).tanh() + (a - c).exp() * 0.1 + (b * b + 1).log() - (2 - a) ** 3 / 5
        return e + (c * a).relu()

    def f_float(a, b, c):
        e = math.tanh(a * b - c / (1 + b ** 2)) + math.exp(a - c) * 0.1 + math.log(b * b + 1) - (2 - a) ** 3 / 5
        return e + max(c * a, 0.0)
    for _ in range(5):
        xs = [rng.uniform(-1.5, 1.5) for _ in range(3)]
        vs = [Value(v) for v in xs]
        out = expr(*vs)
        out.backward()
        assert out.data == pytest.approx(f_float(*xs), rel=1e-12)
        for v, g in zip(vs, fd_grad(f_float, xs)):
            assert v.grad == pytest.approx(g, rel=1e-5, abs=1e-7)


def test_zero_grad_resets():
    w, x = Value(-0.7), Value(1.5)
    h = w * x
    out = h.tanh() * w
    out.backward()
    first = (w.grad, x.grad)
    out.zero_grad()
    assert w.grad == 0.0 and x.grad == 0.0 and h.grad == 0.0 and out.grad == 0.0
    out.backward()
    assert (w.grad, x.grad) == pytest.approx(first)


def test_trains_tiny_neuron():
    rng = random.Random(0)
    data = [([2.0, 3.0], 1.0), ([3.0, -1.0], -1.0), ([-1.0, -2.0], -1.0), ([1.0, 2.0], 1.0)]
    ws = [Value(rng.uniform(-1, 1)) for _ in range(2)]
    b = Value(0.0)

    def loss_fn():
        loss = Value(0.0)
        for xs, y in data:
            pred = (sum((w * xi for w, xi in zip(ws, xs)), b)).tanh()
            loss = loss + (pred - y) ** 2
        return loss
    start = loss_fn().data
    for _ in range(150):
        loss = loss_fn()
        loss.zero_grad()
        loss.backward()
        for p in ws + [b]:
            p.data -= 0.1 * p.grad
    end = loss_fn().data
    assert end < 0.1 < start
    for xs, y in data:
        pred = math.tanh(sum(w.data * xi for w, xi in zip(ws, xs)) + b.data)
        assert pred * y > 0


def test_invalid_inputs_raise():
    with pytest.raises(ValueError):
        Value(0.0).log()
    with pytest.raises(ValueError):
        Value(-2.0).log()
    with pytest.raises(TypeError):
        Value(2.0) ** Value(3.0)
