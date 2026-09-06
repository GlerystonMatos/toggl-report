terraform {
  required_version = ">= 1.9.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Estado local (terraform.tfstate), mesmo raciocínio de terraform/finops —
  # ver comentário lá.
}
