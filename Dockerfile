# 1. 빌드 및 실행 환경 설정
FROM node:24-alpine

# 2. 작업 디렉토리 생성
WORKDIR /app

# 3. 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm install

# 4. 소스 코드 복사
COPY . .

# 5. 환경 변수 설정 (기본값)
ENV PORT=5000
ENV NODE_ENV=production

# 6. 포트 개방
EXPOSE 5000

# 7. 서버 실행
CMD ["node", "server.js"]
