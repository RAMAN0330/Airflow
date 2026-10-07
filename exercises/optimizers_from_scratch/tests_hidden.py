"""Hidden validation suite for optimizers_from_scratch."""
import math

import numpy as np
import pytest

import submission as sub

rng = np.random.default_rng(11)


def ref_adam(params, grads_seq, lr, b1, b2, eps, wd, decoupled):
    """Independent reference following Algorithm 1 of Kingma & Ba / Loshchilov & Hutter."""
    ps = [p.astype(float).copy() for p in params]
    ms = [np.zeros_like(p) for p in ps]
    vs = [np.zeros_like(p) for p in ps]
    for t, grads in enumerate(grads_seq, start=1):
        for i, g in enumerate(grads):
            if decoupled:
                ps[i] = ps[i] - lr * wd * ps[i]
            else:
                g = g + wd * ps[i]
            ms[i] = b1 * ms[i] + (1 - b1) * g
            vs[i] = b2 * vs[i] + (1 - b2) * g ** 2
            mh = ms[i] / (1 - b1 ** t)
            vh = vs[i] / (1 - b2 ** t)
            ps[i] = ps[i] - lr * mh / (np.sqrt(vh) + eps)
    return ps


def rosenbrock_grad(p):
    x, y = p
    return np.array([-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)])


def test_sgd_step_hand_computed():
    p = np.array([1.0, 2.0])
    sub.SGD(lr=0.1).step([p], [np.array([0.5, -1.0])])
    np.testing.assert_allclose(p, [0.95, 2.1], atol=1e-15)
    # L2 weight decay in SGD adds wd·p to the gradient: g = 0.5 + 0.2·1 = 0.7.
    p = np.array([1.0])
    sub.SGD(lr=0.1, weight_decay=0.2).step([p], [np.array([0.5])])
    np.testing.assert_allclose(p, [0.93], atol=1e-15)


def test_momentum_and_nesterov_hand_computed():
    g = [np.array([1.0])]
    p = np.array([0.0])
    opt = sub.SGD(lr=0.1, momentum=0.9)
    opt.step([p], g)
    np.testing.assert_allclose(p, [-0.1], atol=1e-15)        # v = 1
    opt.step([p], g)
    np.testing.assert_allclose(p, [-0.29], atol=1e-15)       # v = 0.9·1 + 1 = 1.9
    p = np.array([0.0])
    opt = sub.SGD(lr=0.1, momentum=0.9, nesterov=True)
    opt.step([p], g)
    np.testing.assert_allclose(p, [-0.19], atol=1e-15)       # g + μv = 1 + 0.9
    opt.step([p], g)
    np.testing.assert_allclose(p, [-0.461], atol=1e-15)      # 1 + 0.9·1.9 = 2.71


def test_rmsprop_hand_computed():
    p = np.array([1.0, -1.0])
    opt = sub.RMSProp(lr=0.01, alpha=0.9, eps=0.0)
    opt.step([p], [np.array([2.0, -0.5])])
    # s = 0.1·g², step = lr·g/√s = lr·sign(g)/√0.1
    np.testing.assert_allclose(p, [1.0 - 0.01 / math.sqrt(0.1), -1.0 + 0.01 / math.sqrt(0.1)], rtol=1e-12)
    opt.step([p], [np.array([2.0, -0.5])])
    s = 0.9 * 0.1 + 0.1                                       # in units of g²
    np.testing.assert_allclose(p, [1.0 - 0.01 / math.sqrt(0.1) - 0.01 / math.sqrt(s),
                                   -1.0 + 0.01 / math.sqrt(0.1) + 0.01 / math.sqrt(s)], rtol=1e-12)


def test_adam_bias_correction_first_steps():
    # After bias correction the very first Adam step is lr·sign(g), whatever the gradient's scale.
    ps = [np.array([0.0, 0.0, 0.0]), np.array([[1.0]])]
    opt = sub.Adam(lr=0.1)
    opt.step(ps, [np.array([1e-3, -5.0, 300.0]), np.array([[-2.0]])])
    np.testing.assert_allclose(ps[0], [-0.1, 0.1, -0.1], rtol=1e-4)
    np.testing.assert_allclose(ps[1], [[1.1]], rtol=1e-6)
    p = np.array([0.0])
    opt = sub.Adam(lr=0.1)
    opt.step([p], [np.array([1.0])])
    opt.step([p], [np.array([-2.0])])
    # m = -0.11, v = 0.004999; m̂ = -0.11/0.19, v̂ = 0.004999/0.001999
    assert p[0] == pytest.approx(-0.06338964652792518, rel=1e-9)


def test_adam_matches_reference():
    params = [rng.normal(size=(3, 4)), rng.normal(size=5)]
    grads_seq = [[rng.normal(size=(3, 4)), rng.normal(size=5) * 10] for _ in range(25)]
    for wd in (0.0, 0.1):
        ps = [p.copy() for p in params]
        opt = sub.Adam(lr=0.01, betas=(0.8, 0.99), eps=1e-6, weight_decay=wd)
        for grads in grads_seq:
            opt.step(ps, grads)
        for got, want in zip(ps, ref_adam(params, grads_seq, 0.01, 0.8, 0.99, 1e-6, wd, decoupled=False)):
            np.testing.assert_allclose(got, want, rtol=1e-10, atol=1e-12)


def test_adamw_decay_is_decoupled():
    # Zero loss gradient: AdamW shrinks weights by exactly (1 − lr·wd) per step...
    p = np.array([2.0, -3.0])
    opt = sub.AdamW(lr=0.1, weight_decay=0.5)
    for k in range(1, 4):
        opt.step([p], [np.zeros(2)])
        np.testing.assert_allclose(p, np.array([2.0, -3.0]) * 0.95 ** k, rtol=1e-12)
    # ...while Adam's L2 penalty goes through the adaptive scaling and moves each weight by about lr.
    p = np.array([2.0, -3.0])
    sub.Adam(lr=0.1, weight_decay=0.5).step([p], [np.zeros(2)])
    np.testing.assert_allclose(p, [1.9, -2.9], rtol=1e-6)
    params = [rng.normal(size=6)]
    grads_seq = [[rng.normal(size=6)] for _ in range(10)]
    ps = [params[0].copy()]
    opt = sub.AdamW(lr=0.05, betas=(0.9, 0.999), eps=1e-8, weight_decay=0.1)
    for grads in grads_seq:
        opt.step(ps, grads)
    want = ref_adam(params, grads_seq, 0.05, 0.9, 0.999, 1e-8, 0.1, decoupled=True)
    np.testing.assert_allclose(ps[0], want[0], rtol=1e-10, atol=1e-12)


def test_step_updates_in_place_and_keeps_grads():
    for make in (lambda: sub.SGD(lr=0.1, momentum=0.9, weight_decay=0.1), lambda: sub.RMSProp(lr=0.1),
                 lambda: sub.Adam(lr=0.1, weight_decay=0.1), lambda: sub.AdamW(lr=0.1)):
        opt = make()
        a, b = rng.normal(size=(2, 3)), rng.normal(size=4)
        ga, gb = rng.normal(size=(2, 3)), rng.normal(size=4)
        a0, ga0, gb0 = a.copy(), ga.copy(), gb.copy()
        params = [a, b]
        opt.step(params, [ga, gb])
        assert params[0] is a and params[1] is b, "update the arrays in place"
        assert not np.allclose(a, a0)
        np.testing.assert_array_equal(ga, ga0)
        np.testing.assert_array_equal(gb, gb0)
        with pytest.raises(ValueError):
            opt.step([a, b], [ga])
        with pytest.raises(ValueError):
            opt.step([a, b], [ga, np.zeros(5)])


def test_cosine_warmup_schedule():
    lr = lambda s, **kw: sub.cosine_warmup_lr(s, base_lr=1.0, warmup_steps=4, total_steps=12, **kw)
    assert [lr(s) for s in range(5)] == pytest.approx([0.0, 0.25, 0.5, 0.75, 1.0])
    assert lr(6) == pytest.approx(0.5 * (1 + math.cos(math.pi / 4)))
    assert lr(8) == pytest.approx(0.5)
    assert lr(12) == pytest.approx(0.0, abs=1e-15) and lr(50) == pytest.approx(0.0, abs=1e-15)
    assert lr(8, min_lr=0.1) == pytest.approx(0.55) and lr(40, min_lr=0.1) == pytest.approx(0.1)
    assert sub.cosine_warmup_lr(0, 3e-4, 0, 100) == pytest.approx(3e-4)
    decay = [lr(s) for s in range(4, 13)]
    assert all(x >= y for x, y in zip(decay, decay[1:]))
    with pytest.raises(ValueError):
        sub.cosine_warmup_lr(-1, 1.0, 4, 12)


def test_momentum_beats_sgd_on_ill_conditioned_quadratic():
    H = np.diag([1.0, 50.0])                    # condition number 50
    def run(opt, steps=300):
        p = np.array([5.0, 5.0])
        for _ in range(steps):
            opt.step([p], [H @ p])
        return np.linalg.norm(p)
    plain = run(sub.SGD(lr=0.019))
    heavy = run(sub.SGD(lr=0.019, momentum=0.9))
    nesterov = run(sub.SGD(lr=0.019, momentum=0.9, nesterov=True))
    assert heavy < 1e-4 and nesterov < 1e-4 and plain > 1e-3
    assert run(sub.Adam(lr=0.05)) < 1e-2
    assert run(sub.RMSProp(lr=0.01), steps=1000) < 1e-3


def test_adam_with_schedule_solves_rosenbrock():
    p = np.array([-1.5, 2.0])
    opt = sub.Adam(lr=0.05)
    for t in range(4000):
        opt.lr = sub.cosine_warmup_lr(t, 0.05, 100, 4000)
        opt.step([p], [rosenbrock_grad(p)])
    np.testing.assert_allclose(p, [1.0, 1.0], atol=1e-3)
