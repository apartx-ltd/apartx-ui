import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import CarouselHost from './__fixtures__/CarouselHost.svelte';

// До регистрации Swiper (и в SSR) Carousel рендерит заглушку. Со snippet `slide` и непустыми
// `items` в заглушке стоит первый слайд — серверный HTML несёт первое фото (SEO), а в браузере
// нет пустого кадра. Без слайдов заглушка пустая и aria-hidden, как раньше.

const items = [
  { url: '/first.jpg', alt: 'First photo' },
  { url: '/second.jpg', alt: 'Second photo' },
];

describe('Carousel SSR placeholder', () => {
  it('renders only the first slide, without aria-hidden', () => {
    const { body } = render(CarouselHost, { props: { items } });
    expect(body).toContain('src="/first.jpg"');
    expect(body).toContain('alt="First photo"');
    expect(body).toContain('data-index="0"');
    expect(body).not.toContain('/second.jpg');
    expect(body).not.toContain('aria-hidden');
    expect(body).not.toContain('swiper-container');
    expect(body).toMatch(/<div class="block overflow-hidden h-64">/);
  });

  it('keeps the empty aria-hidden placeholder when items are empty', () => {
    const { body } = render(CarouselHost, { props: { items: [] } });
    expect(body).toMatch(/<div class="block h-64" aria-hidden="true"><\/div>/);
    expect(body).not.toContain('<img');
  });

  it('keeps the empty aria-hidden placeholder in children mode', () => {
    const { body } = render(CarouselHost, { props: { withSlide: false } });
    expect(body).toMatch(/<div class="block h-64" aria-hidden="true"><\/div>/);
    expect(body).not.toContain('/child.jpg');
  });
});
