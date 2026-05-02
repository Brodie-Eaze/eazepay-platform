terraform {
  backend "s3" {
    bucket         = "eazepay-tfstate-dev"
    key            = "envs/dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "eazepay-tfstate-locks"
    encrypt        = true
    kms_key_id     = "alias/eazepay/tfstate"
  }
}
