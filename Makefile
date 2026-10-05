.PHONY: install api web test check up

install:
	pip install -r requirements.txt
	cd web && npm install

api:
	uvicorn api.main:app --reload --port 8000

web:
	cd web && npm run dev

test:
	python -m pytest -q

check: test
	cd web && npm run typecheck && npm run lint

up:
	docker compose up --build
