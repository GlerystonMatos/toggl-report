terraform {
  required_version = ">= 1.9.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # Estado local (terraform.tfstate), de propósito: projeto pessoal, sem
  # colaboração em equipe — não há bucket GCS de state remoto (evita criar
  # um recurso GCP só para isso, fora do escopo de custo zero).
}
