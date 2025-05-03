document.addEventListener('DOMContentLoaded', function() {
    // 스크롤 시 헤더 스타일 변경
    const header = document.querySelector('header');
    const scrollThreshold = 50;

    window.addEventListener('scroll', () => {
        if (window.scrollY > scrollThreshold) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // 스무스 스크롤 구현
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - header.offsetHeight,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 이미지 지연 로딩 구현 (추후 실제 이미지 사용 시)
    const lazyLoadImages = () => {
        const imageElements = document.querySelectorAll('.lazy-load');
        const options = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src');
                    
                    if (src) {
                        img.src = src;
                        img.classList.remove('lazy-load');
                    }
                    
                    observer.unobserve(img);
                }
            });
        }, options);

        imageElements.forEach(img => {
            imageObserver.observe(img);
        });
    };

    // 이미지가 추가되면 지연 로딩 함수 호출
    // lazyLoadImages();

    // 모바일 메뉴 토글 기능 (추후 구현)
    const implementMobileMenu = () => {
        const mobileMenuToggle = document.createElement('button');
        mobileMenuToggle.className = 'mobile-menu-toggle';
        mobileMenuToggle.innerHTML = '<span></span><span></span><span></span>';
        
        const nav = document.querySelector('nav');
        header.insertBefore(mobileMenuToggle, nav);
        
        mobileMenuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
        });
    };

    // 화면 크기가 작을 때만 모바일 메뉴 구현
    if (window.innerWidth <= 768) {
        // implementMobileMenu(); // 추후 구현
    }

    // 윈도우 리사이즈 이벤트 처리
    window.addEventListener('resize', () => {
        // 추후 구현
    });

    // 페이지 로딩 애니메이션 (추후 구현)
    const fadeInContent = () => {
        const contentElements = document.querySelectorAll('.fade-in');
        contentElements.forEach(el => {
            el.classList.add('visible');
        });
    };

    // 페이지 로딩 완료 시 애니메이션 실행
    // setTimeout(fadeInContent, 500);

    // 스크롤 애니메이션 구현 (추후 구현)
    const animateOnScroll = () => {
        const animatedElements = document.querySelectorAll('.animate-on-scroll');
        const options = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        const animationObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animated');
                    observer.unobserve(entry.target);
                }
            });
        }, options);

        animatedElements.forEach(el => {
            animationObserver.observe(el);
        });
    };

    // 추후 애니메이션 요소가 추가되면 호출
    // animateOnScroll();

    // 3D 모델 뷰어 (Three.js) - 추후 구현 예정
    const initialize3DViewer = () => {
        // Three.js 코드 구현 예정
    };

    // 가상 투어 기능 (추후 구현 예정)
    const initializeVirtualTour = () => {
        // 가상 투어 관련 코드 구현 예정
    };

    console.log('디지털 문화유산 플랫폼이 성공적으로 로드되었습니다.');
});