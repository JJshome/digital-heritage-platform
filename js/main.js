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

    // 패스워드 강도 측정 함수
    const measurePasswordStrength = (password) => {
        let score = 0;
        
        // 길이 점수
        if (password.length > 8) score += 1;
        if (password.length > 12) score += 1;
        
        // 복잡성 점수
        if (/[A-Z]/.test(password)) score += 1; // 대문자
        if (/[a-z]/.test(password)) score += 1; // 소문자
        if (/[0-9]/.test(password)) score += 1; // 숫자
        if (/[^A-Za-z0-9]/.test(password)) score += 1; // 특수문자
        
        // 점수 범위 반환 (0-6)
        return score;
    };

    // 비밀번호 필드 강도 표시 기능
    const passwordFields = document.querySelectorAll('.password-field');
    passwordFields.forEach(field => {
        const input = field.querySelector('input');
        const strengthMeter = field.querySelector('.strength-meter');
        
        if (input && strengthMeter) {
            input.addEventListener('input', () => {
                const strength = measurePasswordStrength(input.value);
                let strengthClass = '';
                
                if (strength < 2) strengthClass = 'weak';
                else if (strength < 4) strengthClass = 'medium';
                else strengthClass = 'strong';
                
                strengthMeter.className = 'strength-meter ' + strengthClass;
                strengthMeter.style.width = ((strength / 6) * 100) + '%';
            });
        }
    });

    // 디지털 자산 유형 차트 (예시)
    const initDigitalAssetChart = () => {
        const ctx = document.getElementById('digital-assets-chart');
        if (ctx) {
            // 차트 데이터 구성 및 렌더링 (실제 구현 시 Chart.js 등의 라이브러리 사용)
            console.log('디지털 자산 차트 초기화');
        }
    };

    // 이용 방법 스텝 강조 효과
    const steps = document.querySelectorAll('.step');
    if (steps.length > 0) {
        const highlightStep = (index) => {
            steps.forEach((step, i) => {
                if (i === index) {
                    step.classList.add('active');
                } else {
                    step.classList.remove('active');
                }
            });
        };

        // 초기 첫 번째 스텝 강조
        highlightStep(0);

        // 스크롤 위치에 따라 스텝 강조 변경 (추후 구현)
        // window.addEventListener('scroll', () => {...});
    }

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

    // FAQ 토글 기능
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                item.classList.toggle('open');
            });
        }
    });

    // 요금제 전환 효과
    const pricingToggles = document.querySelectorAll('.pricing-toggle');
    pricingToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const monthly = document.querySelector('.pricing-monthly');
            const yearly = document.querySelector('.pricing-yearly');
            
            if (monthly && yearly) {
                monthly.classList.toggle('active');
                yearly.classList.toggle('active');
            }
            
            pricingToggles.forEach(t => t.classList.toggle('active'));
        });
    });

    // 디지털 자산 추가 양식
    const assetForm = document.getElementById('add-asset-form');
    if (assetForm) {
        assetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // 폼 데이터 처리 (추후 실제 구현)
            console.log('디지털 자산 추가 양식 제출');
            
            // 성공 메시지 표시
            const successMessage = document.createElement('div');
            successMessage.className = 'success-message';
            successMessage.textContent = '디지털 자산이 성공적으로 추가되었습니다.';
            
            assetForm.reset();
            assetForm.appendChild(successMessage);
            
            setTimeout(() => {
                successMessage.remove();
            }, 3000);
        });
    }

    // Ucaretron Inc. 특허 기술 정보 모달
    const patentInfoLinks = document.querySelectorAll('.patent-info-link');
    const closeModalButtons = document.querySelectorAll('.close-modal');
    
    patentInfoLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = document.getElementById('patent-modal');
            if (modal) {
                modal.classList.add('open');
                document.body.style.overflow = 'hidden';
            }
        });
    });
    
    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) {
                modal.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
    });

    // 페이지 로딩 완료 메시지
    console.log('디지털 유산 관리 플랫폼이 성공적으로 로드되었습니다.');
    console.log('This technical content is based on patented technology filed by Ucaretron Inc.');
});